import { useQuery } from '@apollo/react-hooks'
import { useInterval } from '@react-corekit/use-interval'
import { ethers } from 'ethers'
import { bigNumberify } from 'ethers/utils'
import React, { useCallback, useEffect, useState } from 'react'

import { MARKET_FEE } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks/connectedWeb3'
import {
  CategoryDataItem,
  GraphMarketMakerDataItem,
  MarketMakerDataItem,
  buildQueryMarkets,
  queryCategories,
} from '../../../../queries/markets_home'
import { CPKService } from '../../../../services'
import { getLogger } from '../../../../util/logger'
import { getArbitratorsByNetwork, getOutcomes } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import { MarketFilters, MarketStates } from '../../../../util/types'

import { MarketHome } from './market_home'

const logger = getLogger('MarketHomeContainer')

type GraphResponseMarkets = {
  fixedProductMarketMakers: GraphMarketMakerDataItem[]
}

type GraphResponseCategories = {
  categories: CategoryDataItem[]
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

  const [filter, setFilter] = useState<MarketFilters>({
    state: MarketStates.open,
    category: 'All',
    title: '',
    sortBy: 'lastActiveDayAndScaledRunningDailyVolume',
    sortByDirection: 'desc',
    arbitrator: null,
    templateId: null,
    currency: null,
  })

  const [markets, setMarkets] = useState<RemoteData<MarketMakerDataItem[]>>(RemoteData.notAsked())
  const [categories, setCategories] = useState<RemoteData<CategoryDataItem[]>>(RemoteData.notAsked())
  const [cpkAddress, setCpkAddress] = useState<Maybe<string>>(null)
  const [moreMarkets, setMoreMarkets] = useState(true)
  const [pageSize, setPageSize] = useState(4)
  const [pageIndex, setPageIndex] = useState(0)
  const calcNow = useCallback(() => (Date.now() / 1000).toFixed(0), [])
  const [now, setNow] = useState<string>(calcNow())
  const [isFiltering, setIsFiltering] = useState(false)
  const { account, library: provider } = context
  const feeBN = ethers.utils.parseEther('' + MARKET_FEE / Math.pow(10, 2))
  const marketQuery = buildQueryMarkets({
    whitelistedTemplateIds: true,
    whitelistedCreators: false,
    ...filter,
  })

  const knownArbitrators = getArbitratorsByNetwork(context.networkId).map(x => x.address)

  const marketsQueryVariables = {
    first: pageSize,
    skip: 0,
    accounts: cpkAddress ? [cpkAddress] : null,
    fee: feeBN.toString(),
    now: +now,
    knownArbitrators,
    ...filter,
  }

  const { data: fetchedMarkets, error, fetchMore, loading } = useQuery<GraphResponseMarkets>(marketQuery, {
    notifyOnNetworkStatusChange: true,
    variables: marketsQueryVariables,
    // loading stuck on true when using useQuery hook , using a fetchPolicy seems to fix it
    // If you do not want to risk displaying any out-of-date information from the cache,
    // it may make sense to use a ‘network-only’ fetch policy.
    // This policy favors showing the most up-to-date information over quick responses.
    fetchPolicy: 'network-only',
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
      }

      setIsFiltering(false)
    } else if (error) {
      setMarkets(RemoteData.failure(error))
      setIsFiltering(false)
    }
  }, [fetchedMarkets, loading, error, context.networkId, pageSize])

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

  const onFilterChange = useCallback((filter: any) => {
    setFilter(filter)
    setMoreMarkets(true)
    setIsFiltering(true)
  }, [])

  const loadNextPage = () => {
    if (!moreMarkets) {
      return
    }

    fetchMore({
      variables: {
        skip: fetchedMarkets && fetchedMarkets.fixedProductMarketMakers.length * (pageIndex + 1),
      },
      updateQuery: (prev: any, { fetchMoreResult }) => {
        setMoreMarkets(fetchMoreResult ? fetchMoreResult.fixedProductMarketMakers.length >= pageSize : false)
        setPageIndex(pageIndex + 1)

        if (!fetchMoreResult) {
          return prev
        }

        return {
          ...{
            fixedProductMarketMakers: [...fetchMoreResult.fixedProductMarketMakers],
          },
        }
      },
    })
  }

  const loadPrevPage = () => {
    if (pageIndex === 0) {
      return
    }

    fetchMore({
      variables: {
        skip: fetchedMarkets && fetchedMarkets.fixedProductMarketMakers.length * (pageIndex - 1),
      },
      updateQuery: (prev: any, { fetchMoreResult }) => {
        setMoreMarkets(true)
        setPageIndex(pageIndex - 1)

        if (!fetchMoreResult) {
          return prev
        }

        return {
          ...{
            fixedProductMarketMakers: [...fetchMoreResult.fixedProductMarketMakers],
          },
        }
      },
    })
  }

  const updatePageSize = (size: number): void => {
    setPageSize(size)
  }

  return (
    <>
      <MarketHome
        categories={categories}
        context={context}
        count={fetchedMarkets ? fetchedMarkets.fixedProductMarketMakers.length : 0}
        currentFilter={filter}
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
