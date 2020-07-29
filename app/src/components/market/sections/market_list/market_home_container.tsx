import { useQuery } from '@apollo/react-hooks'
import { useInterval } from '@react-corekit/use-interval'
import { ethers } from 'ethers'
import { bigNumberify } from 'ethers/utils'
import React, { useCallback, useEffect, useState } from 'react'
import { useHistory } from 'react-router'
import { useLocation } from 'react-router-dom'

import { MAX_MARKET_FEE } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks/connectedWeb3'
import {
  GraphMarketMakerDataItem,
  MarketMakerDataItem,
  buildQueryMarkets,
  queryCategories,
  queryMyMarkets,
} from '../../../../queries/markets_home'
import { CPKService } from '../../../../services'
import { getLogger } from '../../../../util/logger'
import { getArbitratorsByNetwork, getOutcomes } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import {
  CategoryDataItem,
  GraphResponseCategories,
  MarketFilters,
  MarketStates,
  MarketsSortCriteria,
} from '../../../../util/types'

import { MarketHome } from './market_home'

const logger = getLogger('MarketHomeContainer')

type Participations = { fixedProductMarketMakers: GraphMarketMakerDataItem }
type GraphResponseMyMarkets = { account: { fpmmParticipations: Participations[] } }
type GraphResponseMarketsGeneric = {
  fixedProductMarketMakers: GraphMarketMakerDataItem[]
}

type GraphResponseMarkets = GraphResponseMarketsGeneric | GraphResponseMyMarkets

const normalizeFetchedData = (data: GraphResponseMyMarkets): GraphResponseMarketsGeneric => {
  return {
    fixedProductMarketMakers: data.account
      ? data.account.fpmmParticipations.map(fpmm => fpmm.fixedProductMarketMakers)
      : [],
  }
}
const wrangleResponse = (data: GraphMarketMakerDataItem[], networkId: number): MarketMakerDataItem[] => {
  return data.map((graphMarketMakerDataItem: GraphMarketMakerDataItem) => {
    const outcomes = graphMarketMakerDataItem.outcomes
      ? graphMarketMakerDataItem.outcomes
      : getOutcomes(networkId, +graphMarketMakerDataItem.templateId)

    return {
      address: graphMarketMakerDataItem.id,
      arbitrator: graphMarketMakerDataItem.arbitrator,
      category: graphMarketMakerDataItem.category,
      collateralToken: graphMarketMakerDataItem.collateralToken,
      collateralVolume: bigNumberify(graphMarketMakerDataItem.collateralVolume),
      openingTimestamp: new Date(1000 * +graphMarketMakerDataItem.openingTimestamp),
      outcomeTokenAmounts: graphMarketMakerDataItem.outcomeTokenAmounts.map(bigNumberify),
      outcomes,
      templateId: +graphMarketMakerDataItem.templateId,
      title: graphMarketMakerDataItem.title,
    }
  })
}

const MarketHomeContainer: React.FC = () => {
  const context = useConnectedWeb3Context()
  const history = useHistory()

  const location = useLocation()

  const sortRoute = location.pathname.split('/')[1]
  let sortDirection: 'desc' | 'asc' = 'desc'

  const currencyFilter = location.pathname.includes('currency') ? true : false
  let currencyRoute = location.pathname.split('/currency/')[1]
  if (currencyRoute) currencyRoute = currencyRoute.split('/')[0]

  const arbitratorFilter = location.pathname.includes('arbitrator') ? true : false
  let arbitratorRoute = location.pathname.split('/arbitrator/')[1]
  if (arbitratorRoute) arbitratorRoute = arbitratorRoute.split('/')[0]

  const categoryFilter = location.pathname.includes('category') ? true : false
  let categoryRoute = location.pathname.split('/category/')[1]
  if (categoryRoute) categoryRoute = categoryRoute.split('/')[0]

  const stateFilter = location.search.includes('state') ? true : false
  let stateRoute = location.search.split('state=')[1]
  if (stateRoute) stateRoute = stateRoute.split('&')[0]

  const searchFilter = location.search.includes('tag') ? true : false
  let searchRoute = location.search.split('tag=')[1]
  if (searchRoute) searchRoute = searchRoute.split('&')[0]

  let sortParam: Maybe<MarketsSortCriteria> = 'lastActiveDayAndScaledRunningDailyVolume'
  if (sortRoute === '24h-volume') {
    sortParam = 'lastActiveDayAndScaledRunningDailyVolume'
  } else if (sortRoute === 'volume') {
    sortParam = 'scaledCollateralVolume'
  } else if (sortRoute === 'newest') {
    sortParam = 'creationTimestamp'
  } else if (sortRoute === 'ending') {
    sortParam = 'openingTimestamp'
    sortDirection = 'asc'
  } else if (sortRoute === 'liquidity') {
    sortParam = 'scaledLiquidityParameter'
  }

  let currencyParam: string | null
  if (currencyFilter) {
    currencyParam = currencyRoute
  } else {
    currencyParam = null
  }

  let arbitratorParam: string | null
  if (arbitratorFilter) {
    arbitratorParam = arbitratorRoute
  } else {
    arbitratorParam = null
  }

  let categoryParam: string
  if (categoryFilter) {
    categoryParam = categoryRoute
  } else {
    categoryParam = 'All'
  }

  let stateParam: MarketStates = MarketStates.open
  if (stateFilter) {
    if (stateRoute === 'OPEN') stateParam = MarketStates.open
    if (stateRoute === 'PENDING') stateParam = MarketStates.pending
    if (stateRoute === 'CLOSED') stateParam = MarketStates.closed
    if (stateRoute === 'MY_MARKETS') stateParam = MarketStates.myMarkets
  } else {
    stateParam = MarketStates.open
  }

  let searchParam: string
  if (searchFilter) {
    searchParam = searchRoute
  } else {
    searchParam = ''
  }

  const [filter, setFilter] = useState<MarketFilters>({
    state: stateParam,
    category: categoryParam,
    title: searchParam,
    sortBy: sortParam,
    sortByDirection: sortDirection,
    arbitrator: arbitratorParam,
    templateId: null,
    currency: currencyParam,
  })

  const [fetchedMarkets, setFetchedMarkets] = useState<Maybe<GraphResponseMarketsGeneric>>(null)
  const [markets, setMarkets] = useState<RemoteData<MarketMakerDataItem[]>>(RemoteData.notAsked())
  const [categories, setCategories] = useState<RemoteData<CategoryDataItem[]>>(RemoteData.notAsked())
  const [cpkAddress, setCpkAddress] = useState<Maybe<string>>(null)
  const [moreMarkets, setMoreMarkets] = useState(true)
  const [pageSize, setPageSize] = useState(4)
  const [pageIndex, setPageIndex] = useState(0)
  const calcNow = useCallback(() => (Date.now() / 1000).toFixed(0), [])
  const [now, setNow] = useState<string>(calcNow())
  const [isFiltering, setIsFiltering] = useState(false)
  const { account, library: provider, networkId } = context
  const feeBN = ethers.utils.parseEther('' + MAX_MARKET_FEE / Math.pow(10, 2))
  const marketQuery = buildQueryMarkets({
    whitelistedTemplateIds: true,
    whitelistedCreators: false,
    ...filter,
    networkId,
  })

  const knownArbitrators = getArbitratorsByNetwork(context.networkId).map(x => x.address)
  const fetchMyMarkets = filter.state === MarketStates.myMarkets

  const marketsQueryVariables = {
    first: pageSize,
    skip: 0,
    accounts: cpkAddress ? [cpkAddress] : null,
    account: cpkAddress && cpkAddress.toLowerCase(),
    fee: feeBN.toString(),
    now: +now,
    knownArbitrators,
    ...filter,
  }

  const { error, fetchMore, loading } = useQuery<GraphResponseMarkets>(fetchMyMarkets ? queryMyMarkets : marketQuery, {
    notifyOnNetworkStatusChange: true,
    variables: marketsQueryVariables,
    // loading stuck on true when using useQuery hook , using a fetchPolicy seems to fix it
    // If you do not want to risk displaying any out-of-date information from the cache,
    // it may make sense to use a ‘network-only’ fetch policy.
    // This policy favors showing the most up-to-date information over quick responses.
    fetchPolicy: 'network-only',
    onCompleted: (data: GraphResponseMarkets) => {
      const markets = fetchMyMarkets
        ? normalizeFetchedData(data as GraphResponseMyMarkets)
        : (data as GraphResponseMarketsGeneric)

      setFetchedMarkets(markets)
    },
  })

  const { data: fetchedCategories, error: categoriesError, loading: categoriesLoading } = useQuery<
    GraphResponseCategories
  >(queryCategories, {
    notifyOnNetworkStatusChange: true,
  })

  useInterval(() => setNow(calcNow), 1000 * 60 * 5)

  useEffect(() => {
    const getCpkAddress = async () => {
      try {
        const cpk = await CPKService.create(provider)
        setCpkAddress(cpk.address)
      } catch (e) {
        logger.error('Could not get address of CPK', e.message)
      }
    }

    if (account) {
      getCpkAddress()
    }
  }, [provider, account])

  useEffect(() => {
    if (loading) {
      setMarkets(markets => (RemoteData.hasData(markets) ? RemoteData.reloading(markets.data) : RemoteData.loading()))
    } else if (fetchedMarkets) {
      const { fixedProductMarketMakers } = fetchedMarkets

      setMarkets(RemoteData.success(wrangleResponse(fixedProductMarketMakers, context.networkId)))

      if (fixedProductMarketMakers.length < pageSize) {
        setMoreMarkets(false)
      } else {
        setMoreMarkets(true)
      }

      setIsFiltering(false)
    } else if (error) {
      setMarkets(RemoteData.failure(error))
      setIsFiltering(false)
    }
  }, [fetchedMarkets, loading, error, context.networkId, pageSize, pageIndex])

  useEffect(() => {
    if (categoriesLoading) {
      setCategories(categories =>
        RemoteData.hasData(categories) ? RemoteData.reloading(categories.data) : RemoteData.loading(),
      )
    } else if (fetchedCategories) {
      const { categories } = fetchedCategories
      setCategories(RemoteData.success(categories))

      setIsFiltering(false)
    } else if (categoriesError) {
      setMarkets(RemoteData.failure(categoriesError))
      setIsFiltering(false)
    }
  }, [fetchedCategories, categoriesLoading, categoriesError, context.networkId])

  const onFilterChange = useCallback(
    (filter: any) => {
      setFilter(filter)
      setMoreMarkets(true)
      setPageIndex(0)
      setIsFiltering(true)

      let route = ''
      const routeQueryStart = '?'
      const routeQueryArray: string[] = []

      if (filter.sortBy === 'lastActiveDayAndScaledRunningDailyVolume') {
        route += '/24h-volume'
      } else if (filter.sortBy === 'scaledCollateralVolume') {
        route += '/volume'
      } else if (filter.sortBy === 'creationTimestamp') {
        route += '/newest'
      } else if (filter.sortBy === 'openingTimestamp') {
        route += '/ending'
      } else if (filter.sortBy === 'scaledLiquidityParameter') {
        route += '/liquidity'
      }

      if (filter.currency) {
        route += `/currency/${filter.currency}`
      }

      if (filter.arbitrator) {
        route += `/arbitrator/${filter.arbitrator}`
      }

      if (filter.category && filter.category !== 'All') {
        route += `/category/${filter.category}`
      }

      if (filter.state && filter.state !== 'OPEN') {
        routeQueryArray.push(`state=${filter.state}`)
      }

      if (filter.title) {
        routeQueryArray.push(`tag=${filter.title}`)
      }

      const routeQueryString = routeQueryArray.join('&')
      const routeQuery = routeQueryStart.concat(routeQueryString)

      history.push(`${route}${routeQuery}`)
    },
    [history],
  )

  const loadNextPage = () => {
    if (!moreMarkets) {
      return
    }

    setPageIndex(pageIndex + 1)

    fetchMore({
      variables: {
        skip: fetchedMarkets && fetchedMarkets.fixedProductMarketMakers.length * (pageIndex + 1),
      },
      updateQuery: (prev: any, { fetchMoreResult }) => {
        return fetchMoreResult || prev
      },
    })
  }

  const loadPrevPage = () => {
    if (pageIndex === 0) {
      return
    }

    setPageIndex(pageIndex - 1)

    fetchMore({
      variables: {
        skip: fetchedMarkets && fetchedMarkets.fixedProductMarketMakers.length * (pageIndex - 1),
      },
      updateQuery: (prev: any, { fetchMoreResult }) => {
        return fetchMoreResult || prev
      },
    })
  }

  const updatePageSize = (size: number): void => {
    setPageSize(size)
    setPageIndex(0)
  }

  return (
    <>
      <MarketHome
        categories={categories}
        context={context}
        count={fetchedMarkets ? fetchedMarkets.fixedProductMarketMakers.length : 0}
        currentFilter={filter}
        fetchMyMarkets={fetchMyMarkets}
        isFiltering={isFiltering}
        markets={markets}
        moreMarkets={moreMarkets}
        onFilterChange={onFilterChange}
        onLoadNextPage={loadNextPage}
        onLoadPrevPage={loadPrevPage}
        onUpdatePageSize={updatePageSize}
        pageIndex={pageIndex}
      />
    </>
  )
}

export { MarketHomeContainer }
