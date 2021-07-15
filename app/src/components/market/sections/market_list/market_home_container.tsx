import { useQuery } from '@apollo/react-hooks'
import { useInterval } from '@react-corekit/use-interval'
import { ethers } from 'ethers'
import { bigNumberify } from 'ethers/utils'
import React, { useCallback, useEffect, useState } from 'react'
import { useHistory } from 'react-router'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import useLocalStorageState from 'use-local-storage-state'

import { MAX_MARKET_FEE } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks'
import { useMarkets } from '../../../../hooks/useMarkets'
import { queryCategories } from '../../../../queries/markets_home'
import { getArbitratorsByNetwork, getOutcomes, networkIds } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import {
  CategoryDataItem,
  CurationSource,
  GraphMarketMakerDataItem,
  GraphResponseCategories,
  MarketFilters,
  MarketMakerDataItem,
  MarketStates,
  MarketsSortCriteria,
} from '../../../../util/types'
import { ButtonCSS } from '../../../button/button_styling_types'
import { IconClose } from '../../../common/icons'

import xDaiIntergation from './img/xDaiIntegration.svg'
import { MarketHome } from './market_home'

const Banner = styled.div`
  ${ButtonCSS};
  user-select: text;
  white-space: unset;
  padding: 20px 24px;
  height: unset;
  cursor: unset;
  max-width: ${props => props.theme.mainContainer.maxWidth};
  margin-bottom: 20px;
  border-color: ${props => props.theme.borders.borderColor}!important;
`
const CloseStyled = styled.div`
  margin-bottom: auto;
`
const TextWrapper = styled.div`
  flex-direction: row;
  text-align: left;
  flex-wrap: wrap;
  margin-left: 20px;
`
const TransferIcon = styled.img`
  width: 52px;
  height: 52px;
  margin-right: auto;
`
const TextTitle = styled.div`
  font-weight: ${props => props.theme.textfield.fontWeight};
  font-size: 16px;
  line-height: 18.75px;
`
const TextDescription = styled.div`
  margin-top: 8px;
  color: ${props => props.theme.text2};
  line-height: 19px;
`
const Link = styled.a`
  color: ${props => props.theme.primary2};
  text-decoration: underline;

  &:hover {
    color: ${props => props.theme.primary3};
  }
`
const IconCloseWrapped = styled(IconClose)`
  color: ${props => props.theme.text1};
`

const wrangleResponse = (data: GraphMarketMakerDataItem[], networkId: number): MarketMakerDataItem[] => {
  return data.map((graphMarketMakerDataItem: GraphMarketMakerDataItem) => {
    const outcomes = graphMarketMakerDataItem.outcomes
      ? graphMarketMakerDataItem.outcomes
      : getOutcomes(networkId, +graphMarketMakerDataItem.templateId)

    return {
      address: graphMarketMakerDataItem.id,
      arbitrator: graphMarketMakerDataItem.arbitrator,
      creationTimestamp: graphMarketMakerDataItem.creationTimestamp,
      curatedByDxDao: graphMarketMakerDataItem.curatedByDxDao,
      category: graphMarketMakerDataItem.category,
      collateralToken: graphMarketMakerDataItem.collateralToken,
      collateralVolume: bigNumberify(graphMarketMakerDataItem.collateralVolume),
      lastActiveDay: Number(graphMarketMakerDataItem.lastActiveDay),
      scaledLiquidityParameter: parseFloat(graphMarketMakerDataItem.scaledLiquidityParameter),
      runningDailyVolumeByHour: graphMarketMakerDataItem.runningDailyVolumeByHour,
      openingTimestamp: new Date(1000 * +graphMarketMakerDataItem.openingTimestamp),
      oracle: graphMarketMakerDataItem.condition.oracle ? graphMarketMakerDataItem.condition.oracle : null,
      outcomeTokenAmounts: graphMarketMakerDataItem.outcomeTokenAmounts.map(bigNumberify),
      outcomeTokenMarginalPrices: graphMarketMakerDataItem.outcomeTokenMarginalPrices,
      outcomes,
      templateId: +graphMarketMakerDataItem.templateId,
      title: graphMarketMakerDataItem.title,
      usdLiquidityParameter: parseFloat(graphMarketMakerDataItem.usdLiquidityParameter),
      klerosTCRregistered: graphMarketMakerDataItem.klerosTCRregistered,
      curatedByDxDaoOrKleros: graphMarketMakerDataItem.curatedByDxDaoOrKleros,
      scalarLow: graphMarketMakerDataItem.condition.scalarLow ? graphMarketMakerDataItem.condition.scalarLow : null,
      scalarHigh: graphMarketMakerDataItem.condition.scalarHigh ? graphMarketMakerDataItem.condition.scalarHigh : null,
    }
  })
}

const MarketHomeContainer: React.FC = () => {
  const context = useConnectedWeb3Context()

  const history = useHistory()
  const [hasSeenBanner, setHasSeenBanner] = useLocalStorageState('hasSeenBanner')

  const location = useLocation()

  const sortRoute = location.pathname.split('/')[1]
  let sortDirection: 'desc' | 'asc' = 'desc'

  const currencyFilter = location.pathname.includes('currency')
  let currencyRoute = location.pathname.split('/currency/')[1]
  if (currencyRoute) currencyRoute = currencyRoute.split('/')[0]

  const arbitratorFilter = location.pathname.includes('arbitrator')
  let arbitratorRoute = location.pathname.split('/arbitrator/')[1]
  if (arbitratorRoute) arbitratorRoute = arbitratorRoute.split('/')[0]

  const curationSourceFilter = location.pathname.includes('curation-source')
  let curationSourceRoute = location.pathname.split('/curation-source/')[1]
  if (curationSourceRoute) curationSourceRoute = curationSourceRoute.split('/')[0]

  const categoryFilter = location.pathname.includes('category')
  let categoryRoute = location.pathname.split('/category/')[1]
  if (categoryRoute) categoryRoute = categoryRoute.split('/')[0]

  const typeFilter = location.pathname.includes('type')
  let typeRoute = location.pathname.split('/type/')[1]
  if (typeRoute) typeRoute = typeRoute.split('/')[0]

  const stateFilter = location.search.includes('state')
  let stateRoute = location.search.split('state=')[1]
  if (stateRoute) stateRoute = stateRoute.split('&')[0]

  const searchFilter = location.search.includes('tag')
  let searchRoute = location.search.split('tag=')[1]
  if (searchRoute) searchRoute = searchRoute.split('&')[0]

  let sortParam: Maybe<MarketsSortCriteria> = stateRoute === 'MY_MARKETS' ? 'openingTimestamp' : 'usdLiquidityParameter'
  if (sortRoute === '24h-volume') {
    sortParam = `sort24HourVolume${Math.floor(Date.now() / (1000 * 60 * 60)) % 24}` as MarketsSortCriteria
  } else if (sortRoute === 'volume') {
    sortParam = 'usdVolume'
  } else if (sortRoute === 'newest') {
    sortParam = 'creationTimestamp'
  } else if (sortRoute === 'ending') {
    sortParam = 'openingTimestamp'
    sortDirection = 'asc'
  } else if (sortRoute === 'liquidity') {
    sortParam = 'usdLiquidityParameter'
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

  let curationSourceParam: CurationSource
  if (curationSourceFilter) {
    curationSourceParam = curationSourceRoute as CurationSource
  } else {
    curationSourceParam = CurationSource.ALL_SOURCES
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
    if (stateRoute === 'FINALIZING') stateParam = MarketStates.finalizing
    if (stateRoute === 'ARBITRATING') stateParam = MarketStates.arbitrating
    if (stateRoute === 'CLOSED') stateParam = MarketStates.closed
    if (stateRoute === 'MY_MARKETS') stateParam = MarketStates.myMarkets
  } else {
    stateParam = MarketStates.open
  }

  let searchParam: string
  if (searchFilter) {
    searchParam = decodeURIComponent(searchRoute)
  } else {
    searchParam = ''
  }

  let typeParam: Maybe<string>
  if (typeFilter) {
    typeParam = typeRoute
  } else {
    typeParam = null
  }

  const [filter, setFilter] = useState<MarketFilters>({
    state: stateParam,
    category: categoryParam,
    title: searchParam,
    sortBy: sortParam,
    sortByDirection: sortDirection,
    arbitrator: arbitratorParam,
    templateId: typeParam,
    currency: currencyParam,
    curationSource: curationSourceParam,
  })

  const [markets, setMarkets] = useState<RemoteData<MarketMakerDataItem[]>>(RemoteData.notAsked())
  const [categories, setCategories] = useState<RemoteData<CategoryDataItem[]>>(RemoteData.notAsked())

  const cpkAddress = context.cpk?.address

  const PAGE_SIZE = 12
  const [pageIndex, setPageIndex] = useState(0)

  const calcNow = useCallback(() => (Date.now() / 1000).toFixed(0), [])
  const [now, setNow] = useState<string>(calcNow())
  const [isFiltering, setIsFiltering] = useState(false)
  const feeBN = ethers.utils.parseEther('' + MAX_MARKET_FEE / Math.pow(10, 2))

  const knownArbitrators = getArbitratorsByNetwork(context.networkId).map(x => x.address)
  const fetchMyMarkets = filter.state === MarketStates.myMarkets

  const marketsQueryVariables = {
    first: PAGE_SIZE,
    skip: pageIndex,
    accounts: cpkAddress ? [cpkAddress] : null,
    account: (cpkAddress && cpkAddress.toLowerCase()) || '',
    fee: feeBN.toString(),
    now: +now,
    knownArbitrators,
    ...filter,
  }

  const { error, loading, markets: fetchedMarkets, moreMarkets } = useMarkets(marketsQueryVariables)

  const { data: fetchedCategories, error: categoriesError, loading: categoriesLoading } = useQuery<
    GraphResponseCategories
  >(queryCategories, {
    notifyOnNetworkStatusChange: true,
  })

  useInterval(() => setNow(calcNow), 1000 * 60 * 5)

  useEffect(() => {
    if (loading) {
      setMarkets(markets => (RemoteData.hasData(markets) ? RemoteData.reloading(markets.data) : RemoteData.loading()))
    } else if (fetchedMarkets) {
      const { fixedProductMarketMakers } = fetchedMarkets
      setMarkets(RemoteData.success(wrangleResponse(fixedProductMarketMakers, context.networkId)))

      setIsFiltering(false)
    } else if (error) {
      setMarkets(RemoteData.failure(error))
      setIsFiltering(false)
    }
  }, [fetchedMarkets, loading, error, context.networkId, PAGE_SIZE, pageIndex])

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
      setPageIndex(0)
      setIsFiltering(true)

      let route = ''
      const routeQueryStart = '?'
      const routeQueryArray: string[] = []

      if (filter.sortBy === `sort24HourVolume${Math.floor(Date.now() / (1000 * 60 * 60)) % 24}`) {
        route += '/24h-volume'
      } else if (filter.sortBy === 'usdVolume') {
        route += '/volume'
      } else if (filter.sortBy === 'creationTimestamp') {
        route += '/newest'
      } else if (filter.sortBy === 'openingTimestamp') {
        route += '/ending'
      } else if (filter.sortBy === 'usdLiquidityParameter') {
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

      if (filter.templateId && filter.templateId !== '') {
        route += `/type/${filter.templateId}`
      }

      if (filter.state && filter.state !== 'OPEN') {
        routeQueryArray.push(`state=${filter.state}`)
      }

      if (filter.title) {
        routeQueryArray.push(`tag=${filter.title}`)
      }

      if (filter.curationSource && filter.curationSource !== 'Any') {
        route += `/curation-source/${filter.curationSource}`
      }

      const routeQueryString = routeQueryArray.join('&')
      const routeQuery = routeQueryStart.concat(routeQueryString)

      history.push(`${route}${routeQuery}`)
    },
    [history],
  )

  useEffect(() => {
    let newFilter = filter
    if (
      filter.state === MarketStates.myMarkets &&
      filter.sortBy !== 'openingTimestamp' &&
      filter.sortBy !== 'creationTimestamp'
    ) {
      newFilter = {
        ...filter,
        sortBy: 'openingTimestamp',
      }
    }

    onFilterChange(newFilter)
  }, [filter, onFilterChange])

  const loadNextPage = () => {
    if (!moreMarkets) {
      return
    }

    setPageIndex(pageIndex + PAGE_SIZE)
  }

  const loadPrevPage = () => {
    if (pageIndex === 0) {
      return
    }

    setPageIndex(pageIndex - PAGE_SIZE)
  }

  return (
    <>
      {hasSeenBanner === undefined && (context.relay || context.networkId === networkIds.MAINNET) && (
        <Banner>
          <TransferIcon alt="" src={xDaiIntergation} />
          <TextWrapper>
            <TextTitle>Scaling Omen with xDai Chain!</TextTitle>
            <TextDescription>
              You now have access to Omen markets on xDai Chain with your Mainnet Ethereum wallet. To use Omen on
              Mainnet choose &quot;Mainnet&quot; from the network dropdown above!{' '}
              <Link
                href={'https://medium.com/omen-eth/omen-goes-xdai-native-9423ee2e0e63'}
                rel="noopener noreferrer"
                target="_blank"
              >
                learn more
              </Link>
            </TextDescription>
          </TextWrapper>
          <CloseStyled
            onClick={() => {
              setHasSeenBanner('true')
            }}
          >
            <IconCloseWrapped hoverEffect size={'24'} />
          </CloseStyled>
        </Banner>
      )}

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
        pageIndex={pageIndex}
      />
    </>
  )
}

export { MarketHomeContainer }
