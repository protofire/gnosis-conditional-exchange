import gql from 'graphql-tag'

import { networkIds } from '../util/networks'

import { BuildQueryType, CurationSource, MarketStates, MarketTypes, MarketsSortCriteria } from './../util/types'

export const MarketDataFragment = gql`
  fragment marketData on FixedProductMarketMaker {
    id
    collateralVolume
    collateralToken
    creationTimestamp
    lastActiveDay
    outcomeTokenAmounts
    runningDailyVolumeByHour
    scaledLiquidityParameter
    title
    outcomes
    openingTimestamp
    arbitrator
    category
    templateId
    scaledLiquidityParameter
    curatedByDxDao
    klerosTCRregistered
    outcomeTokenMarginalPrices
    condition {
      id
      oracle
      scalarLow
      scalarHigh
    }
  }
`

export const DEFAULT_OPTIONS = {
  state: MarketStates.open,
  whitelistedCreators: false,
  whitelistedTemplateIds: true,
  category: 'All',
  title: null as Maybe<string>,
  arbitrator: null as Maybe<string>,
  templateId: null as Maybe<string>,
  currency: null as Maybe<string>,
  curationSource: CurationSource.ALL_SOURCES,
  sortBy: null as Maybe<MarketsSortCriteria>,
  sortByDirection: 'desc' as 'asc' | 'desc',
  networkId: 1 as Maybe<number>,
  type: MarketTypes.all,
}

export const buildQueryMyMarkets = (options: BuildQueryType = DEFAULT_OPTIONS) => {
  const { arbitrator, category, currency, sortBy, title } = options

  const myMarketsWhereClause = [
    sortBy === 'openingTimestamp' ? 'openingTimestamp_gt: $now' : '',
    category === 'All' ? '' : 'category: $category',
    arbitrator ? 'arbitrator: $arbitrator' : 'arbitrator_in: $knownArbitrators',
    'oracle_in: $knownOracles',
    currency ? 'collateralToken: $currency' : '',
    title ? 'title_contains: $title' : '',
  ]
    .filter(s => s.length)
    .join(',')

  const queryMyMarkets = gql`
    query GetMyMarkets($account: String!, $first: Int!, $skip: Int!, $sortBy: String, $sortByDirection: String, $category: String, $arbitrator: String, $knownArbitrators: [String!], $currency: String, $title: String, $now: Int) {
      account(id: $account) {
        fpmmParticipations(first: $first, skip: $skip, orderBy: $sortBy, orderDirection: $sortByDirection, where: { ${myMarketsWhereClause} }) {
          fixedProductMarketMakers: fpmm {
            ...marketData
          }
        }
      }
    }
    ${MarketDataFragment}
  `

  return queryMyMarkets
}

export const buildQueryMarkets = (options: BuildQueryType = DEFAULT_OPTIONS) => {
  const {
    arbitrator,
    category,
    curationSource,
    currency,
    networkId,
    state,
    templateId,
    title,
    whitelistedCreators,
    whitelistedTemplateIds,
  } = options

  const MIN_TIMEOUT = networkId && networkId === 1 ? 86400 : 0
  const whereClause = [
    state === MarketStates.closed ? 'answerFinalizedTimestamp_lt: $now' : '',
    state === MarketStates.open ? 'openingTimestamp_gt: $now' : '',
    state === MarketStates.pending || state === MarketStates.finalizing ? 'openingTimestamp_lt: $now' : '',
    state === MarketStates.pending || state === MarketStates.finalizing ? 'isPendingArbitration: false' : '',
    state === MarketStates.finalizing ? 'answerFinalizedTimestamp_gt: $now' : '',
    state === MarketStates.pending ? 'currentAnswer: null' : '',
    state === MarketStates.finalizing ? 'currentAnswer_not: null' : '',
    state === MarketStates.arbitrating ? 'isPendingArbitration: true' : '',
    whitelistedCreators ? 'creator_in: $accounts' : '',
    category === 'All' ? '' : 'category: $category',
    title ? 'title_contains: $title' : '',
    currency ? 'collateralToken: $currency' : '',
    arbitrator ? 'arbitrator: $arbitrator' : 'arbitrator_in: $knownArbitrators',
    'oracle_in: $knownOracles',
    templateId ? 'templateId: $templateId' : whitelistedTemplateIds ? 'templateId_in: ["0", "1", "2", "6"]' : '',
    'fee_lte: $fee',
    `timeout_gte: ${MIN_TIMEOUT}`,
    networkId === networkIds.XDAI || networkId === networkIds.SOKOL
      ? 'curatedByDxDaoOrKleros: false'
      : curationSource === CurationSource.DXDAO
      ? `curatedByDxDao: true`
      : curationSource === CurationSource.KLEROS
      ? `klerosTCRregistered: true`
      : curationSource === CurationSource.ALL_SOURCES
      ? `curatedByDxDaoOrKleros: true`
      : 'curatedByDxDaoOrKleros: false', // This is option CurationSource.NO_SOURCES (i.e. show unverified results.),
  ]
    .filter(s => s.length)
    .join(',')

  const query = gql`
    query GetMarkets($first: Int!, $skip: Int!, $sortBy: String, $sortByDirection: String, $category: String, $title: String, $currency: String, $arbitrator: String, $knownArbitrators: [String!], $knownOracles: [String!], $templateId: String, $accounts: [String!], $now: Int, $fee: String) {
      fixedProductMarketMakers(first: $first, skip: $skip, orderBy: $sortBy, orderDirection: $sortByDirection, where: { ${whereClause} }) {
        ...marketData
      }
    }
    ${MarketDataFragment}
  `
  return query
}

export const queryCategories = gql`
  {
    categories(first: 100, orderBy: numOpenConditions, orderDirection: desc) {
      id
      numOpenConditions
      numClosedConditions
      numConditions
    }
  }
`

export const queryTopCategories = gql`
  query GetTopCategories($first: Int!) {
    categories(first: $first, orderBy: numOpenConditions, orderDirection: desc) {
      id
    }
  }
`
