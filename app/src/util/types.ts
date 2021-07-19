import Big from 'big.js'
import { Block } from 'ethers/providers'
import { BigNumber } from 'ethers/utils'

import { Outcome } from '../components/market/sections/market_create/steps/outcomes'

export enum Status {
  Ready = 'Ready',
  Loading = 'Loading',
  Refreshing = 'Refreshing',
  Done = 'Done',
  Error = 'Error',
}

export enum ExchangeCurrency {
  Dai,
  Omen,
}

export enum KlerosItemStatus {
  Absent = 'Absent',
  Registered = 'Registered',
  RegistrationRequested = 'RegistrationRequested',
  ClearingRequested = 'ClearingRequested',
}

export enum KlerosDisputeOutcome {
  None = 'None',
  Accept = 'Accept',
  Refuse = 'Refuse',
}

export interface MarketCurationState {
  verificationState: MarketVerificationState
  submissionTime?: number
  itemID?: string
}

export interface KlerosCurationData {
  listingCriteriaURL: string
  submissionDeposit: string
  challengePeriodDuration: string
  submissionBaseDeposit: string
  removalBaseDeposit: string
  marketVerificationData: MarketCurationState
  ovmAddress: string // ovm here stands for Omen Verified Markets, the Kleros-Omen TCR.
}

export interface BalanceItem {
  outcomeName: string
  probability: number
  currentPrice: number
  currentDisplayPrice?: number
  shares: BigNumber
  payout: Big
  holdings: BigNumber
}

export interface BondItem {
  outcomeName: string
  bondedEth: BigNumber
}

export interface AnswerItem {
  answer: string
  bondAggregate: BigNumber
}

export interface KlerosSubmission {
  id: string
  status: KlerosItemStatus
  listAddress: string
}

export enum Stage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

export interface TokenAmountInterface {
  amount: BigNumber
  decimals: number
  format: (precision?: number) => string
  interestRate?: number
  price?: number
  depositBalance?: TokenAmountInterface
  walletBalance?: TokenAmountInterface
}

export enum StepProfile {
  View = 'View',
  Buy = 'Buy',
  Sell = 'Sell',
  CloseMarketDetail = 'CloseMarketDetail',
}

export interface Question {
  id: string
  raw: string
  templateId: number
  title: string
  resolution: Date
  arbitratorAddress: string
  category: string
  outcomes: string[]
  isPendingArbitration: boolean
  arbitrationOccurred: boolean
  currentAnswerTimestamp: Maybe<BigNumber>
  currentAnswerBond: Maybe<BigNumber>
  currentAnswer: string
  answers?: {
    answer: string
    bondAggregate: BigNumber
  }[]
  bonds?: BondItem[]
}

export enum OutcomeTableValue {
  OutcomeProbability = 'Outcome/Probability',
  CurrentPrice = 'Price',
  Shares = 'My Shares',
  Payout = 'Payout',
  Outcome = 'Outcome',
  Probability = 'Probability',
  Bonded = 'Bonded',
}

export enum PositionTableValue {
  YourPosition = 'Your Position',
  Shares = 'Shares',
  Payout = 'Payout',
  ProfitLoss = 'Profit/loss',
}

export interface Token {
  address: string
  decimals: number
  symbol: string
  image?: string
  volume?: number
  balance?: string
  name?: string
  allowance?: string
}

export interface QuestionLog {
  category: string
  lang: string
  title: string
  type: string
  outcomes?: string[]
}

export interface Market {
  address: string
  ownerAddress: string
  collateralTokenAddress: string
  conditionId: string
}

export enum MarketStatus {
  Open = 'Open',
  Closed = 'Closed',
}

export type MarketWithExtraData = Market & {
  fee: BigNumber
  question: Question
  status: MarketStatus
}

export enum MarketVerificationState {
  Verified,
  NotVerified,
  SubmissionChallengeable,
  RemovalChallengeable,
  WaitingArbitration,
}

export interface Log {
  topics: Array<string>
  data: string
}

export interface Arbitrator {
  address: string
  id: KnownArbitrator
  isSelectionEnabled: boolean
  name: string
  url: string
}

export enum Wallet {
  MetaMask = 'MetaMask',
  WalletConnect = 'WalletConnect',
  Authereum = 'Authereum',
}

export interface MarketData {
  collateral: Token
  arbitratorsCustom: Arbitrator[]
  categoriesCustom: string[]
  question: string
  category: string
  resolution: Date | null
  arbitrator: Arbitrator
  spread: number
  funding: BigNumber
  outcomes: Outcome[]
  loadedQuestionId: Maybe<string>
  verifiedLabel?: string
  lowerBound: Maybe<BigNumber>
  upperBound: Maybe<BigNumber>
  startingPoint: Maybe<BigNumber>
  unit: string
}

export enum MarketStates {
  open = 'OPEN',
  pending = 'PENDING',
  finalizing = 'FINALIZING',
  arbitrating = 'ARBITRATING',
  closed = 'CLOSED',
  myMarkets = 'MY_MARKETS',
}

export enum MarketTypes {
  all = '',
  categorical = '2',
  scalar = '1',
}

export type MarketsSortCriteria =
  | 'usdVolume'
  | 'creationTimestamp'
  | 'openingTimestamp'
  | 'usdLiquidityParameter'
  | 'lastActiveDayAndScaledRunningDailyVolume'
  | 'sort24HourVolume0'
  | 'sort24HourVolume1'
  | 'sort24HourVolume2'
  | 'sort24HourVolume3'
  | 'sort24HourVolume4'
  | 'sort24HourVolume5'
  | 'sort24HourVolume6'
  | 'sort24HourVolume7'
  | 'sort24HourVolume8'
  | 'sort24HourVolume9'
  | 'sort24HourVolume10'
  | 'sort24HourVolume11'
  | 'sort24HourVolume12'
  | 'sort24HourVolume13'
  | 'sort24HourVolume14'
  | 'sort24HourVolume15'
  | 'sort24HourVolume16'
  | 'sort24HourVolume17'
  | 'sort24HourVolume18'
  | 'sort24HourVolume19'
  | 'sort24HourVolume20'
  | 'sort24HourVolume21'
  | 'sort24HourVolume22'
  | 'sort24HourVolume23'

export enum CurationSource {
  ALL_SOURCES = 'Any',
  DXDAO = 'Dxdao',
  KLEROS = 'Kleros',
  NO_SOURCES = 'None',
}

export interface MarketFilters {
  state: MarketStates
  category: string
  title: Maybe<string>
  sortBy: Maybe<MarketsSortCriteria>
  sortByDirection: 'desc' | 'asc'
  arbitrator: Maybe<string>
  templateId: Maybe<string>
  currency: Maybe<string>
  curationSource: CurationSource
}

export interface MarketMakerData {
  address: string
  answerFinalizedTimestamp: Maybe<BigNumber>
  arbitrator: Arbitrator
  balances: BalanceItem[]
  creationTimestamp: string
  collateral: Token
  userInputCollateral: Token | null
  creator: string
  fee: BigNumber
  isConditionResolved: boolean
  isQuestionFinalized: boolean
  collateralVolume: BigNumber
  marketMakerFunding: BigNumber
  marketMakerUserFunding: BigNumber
  payouts: Maybe<Big[]>
  question: Question
  realitioAnswer: Maybe<BigNumber>
  totalEarnings: BigNumber
  totalPoolShares: BigNumber
  userEarnings: BigNumber
  userPoolShares: BigNumber
  klerosTCRregistered: boolean
  curatedByDxDao: boolean
  curatedByDxDaoOrKleros: boolean
  runningDailyVolumeByHour: BigNumber[]
  lastActiveDay: number
  scaledLiquidityParameter: number
  submissionIDs: KlerosSubmission[]
  oracle: string
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
  outcomeTokenMarginalPrices: string[]
  outcomeTokenAmounts: string[]
}

export enum Ternary {
  True,
  False,
  Unknown,
}

export type HistoricDataPoint = {
  block: Block
  holdings: string[]
}

export type HistoricData = HistoricDataPoint[]
export type Period = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All'

export type CategoryDataItem = {
  id: string
  numOpenConditions: number
  numClosedConditions: number
  numConditions: number
}

export type GraphResponseCategories = {
  categories: CategoryDataItem[]
}

export type TopCategoryItem = {
  id: string
  typename: string
}

export type GraphResponseTopCategories = {
  categories: TopCategoryItem[]
}

export type GraphMarketMakerDataItem = {
  id: string
  creationTimestamp: string
  collateralVolume: string
  lastActiveDay: number
  collateralToken: string
  outcomeTokenAmounts: string[]
  title: string
  outcomes: Maybe<string[]>
  openingTimestamp: string
  arbitrator: string
  category: string
  templateId: string
  usdLiquidityParameter: string
  curatedByDxDao: boolean
  scaledLiquidityParameter: string
  klerosTCRregistered: boolean
  curatedByDxDaoOrKleros: boolean
  runningDailyVolumeByHour: BigNumber[]
  condition: MarketCondition
  outcomeTokenMarginalPrices: string[]
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
}

export type Participations = { fixedProductMarketMakers: GraphMarketMakerDataItem }

export type GraphResponseMyMarkets = { account: { fpmmParticipations: Participations[] } }

export type GraphResponseMarketsGeneric = {
  fixedProductMarketMakers: GraphMarketMakerDataItem[]
}

export type GraphResponseMarkets = GraphResponseMarketsGeneric | GraphResponseMyMarkets

export type MarketMakerDataItem = {
  address: string
  creationTimestamp: string
  collateralVolume: BigNumber
  collateralToken: string
  lastActiveDay: number
  outcomeTokenAmounts: BigNumber[]
  title: string
  outcomes: Maybe<string[]>
  openingTimestamp: Date
  arbitrator: string
  category: string
  templateId: number
  usdLiquidityParameter: number
  curatedByDxDao: boolean
  scaledLiquidityParameter: number
  klerosTCRregistered: boolean
  curatedByDxDaoOrKleros: boolean
  runningDailyVolumeByHour: BigNumber[]
  oracle: Maybe<string>
  outcomeTokenMarginalPrices: string[]
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
}

export type BuildQueryType = MarketFilters & {
  whitelistedCreators: boolean
  whitelistedTemplateIds: boolean
  networkId: Maybe<number>
}

export type TradeObject = {
  title: string
  outcomeTokensTraded: BigNumber
  collateralAmount: BigNumber
  feeAmount: BigNumber
  outcomeTokenMarginalPrice: number
  oldOutcomeTokenMarginalPrice: number
  type: string
  outcomeIndex: string
}

export type LiquidityObject = {
  type: string
  additionalSharesCost: BigNumber
  outcomeTokenAmounts: BigNumber[]
}

export type MarketCondition = {
  oracle: Maybe<string>
  scalarHigh: Maybe<BigNumber>
  scalarLow: Maybe<BigNumber>
}

export type KnownTokenValue = {
  token: KnownToken
  value: BigNumber
}

export enum MarketDetailsTab {
  swap = 'SWAP',
  pool = 'POOL',
  history = 'HISTORY',
  verify = 'VERIFY',
  buy = 'BUY',
  sell = 'SELL',
  finalize = 'FINALIZE',
  setOutcome = 'SET_OUTCOME',
}

export enum MarketState {
  open = 'open',
  finalizing = 'finalizing',
  arbitration = 'arbitration',
  closed = 'closed',
  none = '',
}

export const INVALID_ANSWER_ID = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

export enum FormState {
  categorical = 'CATEGORICAL',
  import = 'IMPORT',
  scalar = 'SCALAR',
}

export enum TradeType {
  buy = 'Buy',
  sell = 'Sell',
}

export enum LiquidityType {
  add = 'Add',
  remove = 'Remove',
}

export type ValueBoxItem = {
  title: string
  subtitle: string
  tooltip?: string
  positive?: boolean
  xValue?: number
  ball?: boolean
}

export enum AdditionalSharesType {
  long = 'Long',
  short = 'Short',
}

export enum WalletState {
  ready,
  enable,
}

export enum ExchangeType {
  deposit = 'Deposit',
  withdraw = 'Withdraw',
}

export enum TransactionStep {
  idle,
  waitingConfirmation,
  transactionSubmitted,
  transactionConfirmed,
  confirming,
  error,
}

export enum TransactionType {
  deposit = 'Deposit',
  withdraw = 'Withdraw',
  buy = 'Buy',
  sell = 'Sell',
  redeem = 'Redeem',
  create = 'Create',
  claim = 'Claim',
}
