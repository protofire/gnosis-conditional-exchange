import { useQuery } from '@apollo/react-hooks'
import React from 'react'

import { buildQueryMarkets, buildQueryMyMarkets } from '../queries/markets_home'
import {
  BuildQueryType,
  GraphMarketMakerDataItem,
  GraphResponseMarkets,
  GraphResponseMarketsGeneric,
  GraphResponseMyMarkets,
  MarketFilters,
  MarketStates,
} from '../util/types'

import { useConnectedWeb3Context } from './connectedWeb3'

interface MarketVariables {
  first: number
  skip: number
  accounts: Maybe<string[]>
  account: Maybe<string>
  fee: string
  now: number
  knownArbitrators: string[]
  knownOracles: string[]
}

type Options = MarketVariables & MarketFilters

const normalizeFetchedData = (data: GraphResponseMyMarkets): GraphMarketMakerDataItem[] => {
  return data && data.account ? data.account.fpmmParticipations.map(fpmm => fpmm.fixedProductMarketMakers) : []
}

export const useMarkets = (options: Options): any => {
  const { networkId } = useConnectedWeb3Context()

  const {
    arbitrator,
    category,
    curationSource,
    currency,
    first,
    skip: skipFromOptions,
    sortBy,
    sortByDirection,
    state,
    templateId,
    title,
  } = options

  const [moreMarkets, setMoreMarkets] = React.useState(true)
  const [markets, setMarkets] = React.useState<GraphResponseMarketsGeneric>({ fixedProductMarketMakers: [] })

  const fetchMyMarkets = state === MarketStates.myMarkets
  const queryOptions: BuildQueryType = {
    whitelistedCreators: false,
    whitelistedTemplateIds: true,
    networkId,
    state,
    category,
    title,
    sortBy,
    sortByDirection,
    arbitrator,
    templateId,
    currency,
    curationSource,
  }

  const marketQuery = buildQueryMarkets(queryOptions)
  const myMarketsQuery = buildQueryMyMarkets(queryOptions)
  const query = fetchMyMarkets ? myMarketsQuery : marketQuery

  const newOptions = { ...options, first: first + 1 }

  const { error, fetchMore, loading } = useQuery<GraphResponseMarkets>(query, {
    notifyOnNetworkStatusChange: true,
    variables: newOptions,
    // loading stuck on true when using useQuery hook , using a fetchPolicy seems to fix it
    // If you do not want to risk displaying any out-of-date information from the cache,
    // it may make sense to use a ‘network-only’ fetch policy.
    // This policy favors showing the most up-to-date information over quick responses.
    fetchPolicy: 'network-only',
    onCompleted: (data: GraphResponseMarkets) => {
      let internalMarkets: GraphMarketMakerDataItem[] = []
      if (fetchMyMarkets) {
        internalMarkets = normalizeFetchedData(data as GraphResponseMyMarkets)
      } else {
        const marketsGeneric = data as GraphResponseMarketsGeneric
        internalMarkets = marketsGeneric.fixedProductMarketMakers
      }
      setMoreMarkets(internalMarkets.length === first + 1)
      if (internalMarkets.length === first + 1) {
        internalMarkets = internalMarkets.slice(0, first)
      }

      if (internalMarkets && internalMarkets.length === 0 && skipFromOptions === 0) {
        setMarkets({
          fixedProductMarketMakers: [],
        })
      } else {
        setMarkets({
          fixedProductMarketMakers: internalMarkets,
        })
      }
    },
  })

  React.useEffect(() => {
    if (!loading) {
      return
    }
    setMarkets({
      fixedProductMarketMakers: [],
    })
  }, [arbitrator, currency, curationSource, category, state, sortBy, templateId, loading])

  return { markets, error, fetchMore, loading, moreMarkets }
}
