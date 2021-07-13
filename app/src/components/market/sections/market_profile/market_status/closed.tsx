import Big from 'big.js'
import { MaxUint256, Zero } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import React, { useEffect, useMemo, useState } from 'react'
import { RouteComponentProps, useHistory, useLocation, withRouter } from 'react-router-dom'
import styled from 'styled-components'

import { STANDARD_DECIMALS } from '../../../../../common/constants'
import { WhenConnected, useConnectedWeb3Context } from '../../../../../contexts/connectedWeb3'
import { useContracts, useGraphMarketUserTxData, useSymbol } from '../../../../../hooks'
import { ERC20Service, RealitioService } from '../../../../../services'
import { CompoundService } from '../../../../../services/compound_service'
import { getLogger } from '../../../../../util/logger'
import { getContractAddress, getNativeAsset } from '../../../../../util/networks'
import { formatBigNumber, getBaseToken, getUnit, isCToken, isDust } from '../../../../../util/tools'
import {
  CompoundTokenType,
  INVALID_ANSWER_ID,
  MarketDetailsTab,
  MarketMakerData,
  OutcomeTableValue,
  Status,
  TransactionStep,
} from '../../../../../util/types'
import { Button, ButtonContainer } from '../../../../button'
import { ButtonType } from '../../../../button/button_styling_types'
import { ModalTransactionWrapper } from '../../../../modal'
import { MarginsButton } from '../../../common/common_styled'
import MarketResolutionMessage from '../../../common/market_resolution_message'
import { MarketScale } from '../../../common/market_scale'
import { MarketTopDetailsClosed } from '../../../common/market_top_details_closed'
import { OutcomeTable } from '../../../common/outcome_table'
import { ViewCard } from '../../../common/view_card'
import { MarketBuyContainer } from '../../market_buy/market_buy_container'
import { MarketHistoryContainer } from '../../market_history/market_history_container'
import { MarketNavigation } from '../../market_navigation'
import { MarketPoolLiquidityContainer } from '../../market_pooling/market_pool_liquidity_container'
import { MarketSellContainer } from '../../market_sell/market_sell_container'

const TopCard = styled(ViewCard)`
  padding-bottom: 0;
  margin-bottom: 24px;
`

const BottomCard = styled(ViewCard)``

const MarketResolutionMessageStyled = styled(MarketResolutionMessage)`
  margin: 20px 0;
`

const StyledButtonContainer = styled(ButtonContainer)`
  margin: 0 -24px;
  margin-bottom: -1px;
  padding: 20px 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const BorderedButtonContainer = styled(ButtonContainer)`
  ${MarginsButton};
`

const SellBuyWrapper = styled.div`
  display: flex;
  align-items: center;

  & > * + * {
    margin-left: 12px;
  }
`

interface Props extends RouteComponentProps<Record<string, string | undefined>> {
  isScalar: boolean
  marketMakerData: MarketMakerData
  fetchGraphMarketMakerData: () => Promise<void>
}

const logger = getLogger('Market::ClosedMarketDetails')

const computeEarnedCollateral = (payouts: Maybe<Big[]>, balances: BigNumber[]): Maybe<BigNumber> => {
  if (!payouts) {
    return null
  }

  // use floor as rounding method
  Big.RM = 0

  const earnedCollateralPerOutcome = balances.map((balance, index) => new Big(balance.toString()).mul(payouts[index]))
  const earnedCollateral = earnedCollateralPerOutcome.reduce((a, b) => a.add(b.toFixed(0)), bigNumberify(0))

  return earnedCollateral
}

const scalarComputeEarnedCollateral = (finalAnswerPercentage: Big, balances: BigNumber[]): Maybe<BigNumber> => {
  if (
    (!balances[0] && !balances[1]) ||
    (balances[0].isZero() && !balances[1]) ||
    (!balances[0] && balances[1].isZero()) ||
    (balances[0].isZero() && balances[1].isZero())
  )
    return null

  // use floor as rounding method
  Big.RM = 0

  const shortEarnedCollateral = new Big(balances[0].toString()).mul(new Big(1).sub(finalAnswerPercentage))
  const longEarnedCollateral = new Big(balances[1].toString()).mul(finalAnswerPercentage)
  const collaterals = [shortEarnedCollateral, longEarnedCollateral]
  const earnedCollateral = collaterals.reduce((a, b) => a.add(b.toFixed(0)), bigNumberify(0))

  return earnedCollateral
}

const calcUserWinningsData = (
  isScalar: boolean,
  shares: BigNumber[],
  payouts: Maybe<Big[]>,
  finalAnswerPercentage: number,
): { userWinningShares: BigNumber; winningOutcomes: number; userWinningOutcomes: number } => {
  let userWinningShares
  let winningOutcomes
  let userWinningOutcomes
  if (isScalar) {
    userWinningShares = shares.reduce((acc, outcome) => (acc && outcome ? acc.add(outcome) : Zero)) || Zero
    winningOutcomes = finalAnswerPercentage === (0 || 1) ? 1 : 2
    userWinningOutcomes = shares.filter((share, i) => {
      const finalAnswerMultiple = i === 0 ? 1 - finalAnswerPercentage : finalAnswerPercentage
      return share && share.gt(Zero) && finalAnswerMultiple > 0
    }).length
  } else {
    userWinningShares = payouts
      ? shares.reduce((acc, shares, index) => (payouts[index].gt(0) && shares ? acc.add(shares) : acc), Zero)
      : Zero
    winningOutcomes = payouts ? payouts.filter(payout => payout.gt(0)).length : 0
    userWinningOutcomes = payouts
      ? payouts.filter((payout, index) => shares[index] && shares[index].gt(0) && payout.gt(0)).length
      : 0
  }
  return { userWinningShares, winningOutcomes, userWinningOutcomes }
}

const Wrapper = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { fetchBalances } = context.balances

  const { account, cpk, library: provider, networkId, relay } = context
  const { buildMarketMaker, conditionalTokens, oracle, realitio } = useContracts(context)

  const { fetchGraphMarketMakerData, isScalar, marketMakerData } = props

  const {
    address: marketMakerAddress,
    arbitrator,
    balances,
    collateral: collateralToken,
    isConditionResolved,
    payouts,
    question,
    realitioAnswer,
    scalarHigh,
    scalarLow,
  } = marketMakerData

  const history = useHistory()
  const location = useLocation()

  const [status, setStatus] = useState<Status>(Status.Ready)
  const [message, setMessage] = useState('')
  const marketCollateralToken = collateralToken
  const [compoundService, setCompoundService] = useState<Maybe<CompoundService>>(null)
  const [collateral, setCollateral] = useState<BigNumber>(new BigNumber(0))
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')
  const [userRealitioWithdraw, setUserRealitioWithdraw] = useState(false)
  const [cpkRealitioWithdraw, setCpkRealitioWithdraw] = useState(false)
  const [userRealitioBalance, setUserRealitioBalance] = useState(Zero)
  const [cpkRealitioBalance, setCpkRealitioBalance] = useState(Zero)

  const [displayEarnedCollateral, setDisplayEarnedCollateral] = useState<BigNumber>(new BigNumber(0))

  const marketMaker = useMemo(() => buildMarketMaker(marketMakerAddress), [buildMarketMaker, marketMakerAddress])
  useMemo(() => {
    const getResult = async () => {
      const compoundServiceObject = new CompoundService(
        marketCollateralToken.address,
        marketCollateralToken.symbol,
        provider,
        account,
      )
      await compoundServiceObject.init()
      setCompoundService(compoundServiceObject)
    }
    if (marketCollateralToken.symbol.toLowerCase() in CompoundTokenType) {
      getResult()
    }
  }, [marketCollateralToken.address, account, marketCollateralToken.symbol, provider])

  useEffect(() => {
    const getDisplayEarnedCollateral = async () => {
      if (isCToken(marketCollateralToken.symbol)) {
        const compound = new CompoundService(
          marketCollateralToken.address,
          marketCollateralToken.symbol,
          provider,
          account,
        )
        await compound.init()
        const earnedCollateral = isScalar
          ? scalarComputeEarnedCollateral(
              new Big(finalAnswerPercentage),
              balances.map(balance => balance.shares),
            )
          : computeEarnedCollateral(
              payouts,
              balances.map(balance => balance.shares),
            )
        if (earnedCollateral) {
          const baseToken = getBaseToken(networkId, collateralToken.symbol)
          const earnings = compound.calculateCTokenToBaseExchange(baseToken, earnedCollateral)
          setDisplayEarnedCollateral(earnings)
        }
      }
    }
    getDisplayEarnedCollateral()
  }, [marketCollateralToken.address, isConditionResolved, account, provider, balances]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveCondition = async () => {
    if (!cpk) {
      return
    }
    try {
      setStatus(Status.Loading)
      setMessage('Resolving condition...')
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)

      await cpk.resolveCondition({
        oracle,
        realitio,
        isScalar,
        scalarLow,
        scalarHigh,
        question,
        numOutcomes: balances.length,
        setTxHash,
        setTxState,
      })

      await fetchGraphMarketMakerData()

      setStatus(Status.Ready)
      setMessage(`Condition successfully resolved.`)
    } catch (err) {
      setStatus(Status.Error)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to resolve the condition.`)
      logger.error(`${message} - ${err.message}`)
    }
  }

  useEffect(() => {
    let isSubscribed = true

    const fetchBalance = async () => {
      const collateralAddress = await marketMaker.getCollateralToken()
      const collateralService = new ERC20Service(provider, account, collateralAddress)
      const collateralBalance = await collateralService.getCollateral(marketMakerAddress)
      if (isSubscribed) setCollateral(collateralBalance)
    }

    fetchBalance()

    return () => {
      isSubscribed = false
    }
  }, [provider, account, marketMakerAddress, marketMaker])

  const getRealitioBalance = async () => {
    if (!cpk || !account) {
      return
    }

    // Check if user has reality balance to redeem
    const realitioService = new RealitioService(
      getContractAddress(networkId, 'realitio'),
      getContractAddress(networkId, 'realitioScalarAdapter'),
      provider,
      account,
    )

    const claimable = await realitioService.getClaimableBonds(question.id, question.currentAnswer)

    if (account !== cpk.address) {
      const userClaimable = claimable[account] || new BigNumber('0')
      const userBalance = await realitioService.getBalanceOf(account)
      const userTotal = userClaimable.add(userBalance)
      setUserRealitioBalance(userTotal)
      setUserRealitioWithdraw(userTotal.gt(Zero))
    }

    const cpkClaimable = claimable[cpk.address] || new BigNumber('0')
    const cpkBalance = await realitioService.getBalanceOf(cpk.address)
    const cpkTotal = cpkClaimable.add(cpkBalance)
    setCpkRealitioWithdraw(cpkTotal.gt(Zero))
    setCpkRealitioBalance(cpkTotal)
  }

  useEffect(() => {
    getRealitioBalance()
    // eslint-disable-next-line
  }, [cpk, networkId, provider, account, question, isConditionResolved])

  const claimBond = async () => {
    try {
      setStatus(Status.Loading)
      setMessage('Claiming bond...')
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)

      await realitio.withdraw(setTxHash, setTxState)
      await fetchBalances()
      await getRealitioBalance()

      setStatus(Status.Ready)
      setMessage(`Bond successfully claimed.`)
    } catch (err) {
      setStatus(Status.Error)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to claim.`)
      logger.error(`${message} -  ${err.message}`)
    }
  }

  const redeem = async () => {
    try {
      if (!cpk) {
        return
      }

      setStatus(Status.Loading)
      setMessage('Redeeming payout...')
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)

      await cpk.redeemPositions({
        isConditionResolved,
        // Round down in case of precision error
        earnedCollateral: earnedCollateral ? earnedCollateral.mul(99999999).div(100000000) : new BigNumber('0'),
        question,
        numOutcomes: balances.length,
        oracle,
        realitio,
        isScalar,
        scalarLow,
        scalarHigh,
        collateralToken,
        marketMaker,
        conditionalTokens,
        realitioBalance: cpkRealitioBalance,
        setTxHash,
        setTxState,
      })
      await fetchBalances()
      await getRealitioBalance()

      setStatus(Status.Ready)
      setMessage(`Payout successfully redeemed.`)
    } catch (err) {
      setStatus(Status.Error)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to redeem.`)
      logger.error(`${message} -  ${err.message}`)
    }
  }

  const probabilities = balances.map(balance => balance.probability)

  const disabledColumns = [OutcomeTableValue.Outcome, OutcomeTableValue.Probability, OutcomeTableValue.Bonded]

  if (!account) {
    disabledColumns.push(OutcomeTableValue.Shares)
  }

  const buySellButtons = (
    <SellBuyWrapper>
      <Button
        buttonType={ButtonType.secondaryLine}
        disabled={true}
        onClick={() => {
          setCurrentTab(MarketDetailsTab.sell)
        }}
      >
        Sell
      </Button>
      <Button
        buttonType={ButtonType.secondaryLine}
        disabled={true}
        onClick={() => {
          setCurrentTab(MarketDetailsTab.buy)
        }}
      >
        Buy
      </Button>
    </SellBuyWrapper>
  )

  const [currentTab, setCurrentTab] = useState(MarketDetailsTab.swap)

  const switchMarketTab = (newTab: MarketDetailsTab) => {
    setCurrentTab(newTab)
  }

  useEffect(() => {
    history.replace(`/${marketMakerAddress}/${currentTab.toLowerCase()}`)
    if (currentTab === MarketDetailsTab.swap) return history.replace(`/${marketMakerAddress}/finalize`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab])

  useEffect(() => {
    if (location.pathname.includes('finalize')) setCurrentTab(MarketDetailsTab.swap)
    if (location.pathname.includes('pool')) setCurrentTab(MarketDetailsTab.pool)
    if (location.pathname.includes('history')) setCurrentTab(MarketDetailsTab.history)
    if (location.pathname.includes('set_outcome')) setCurrentTab(MarketDetailsTab.swap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { fetchData: fetchGraphMarketUserTxData } = useGraphMarketUserTxData(
    marketMakerAddress,
    cpk?.address.toLowerCase(),
  )

  const realitioAnswerNumber = Number(formatBigNumber(realitioAnswer || new BigNumber(0), STANDARD_DECIMALS))
  const scalarLowNumber = Number(formatBigNumber(scalarLow || new BigNumber(0), STANDARD_DECIMALS))
  const scalarHighNumber = Number(formatBigNumber(scalarHigh || new BigNumber(0), STANDARD_DECIMALS))

  const unclampedFinalAnswerPercentage =
    realitioAnswer && realitioAnswer.eq(MaxUint256)
      ? 0.5
      : isConditionResolved
      ? balances[1].payout
      : (realitioAnswerNumber - scalarLowNumber) / (scalarHighNumber - scalarLowNumber)

  const finalAnswerPercentage =
    unclampedFinalAnswerPercentage > 1 ? 1 : unclampedFinalAnswerPercentage < 0 ? 0 : unclampedFinalAnswerPercentage

  const earnedCollateral = isScalar
    ? scalarComputeEarnedCollateral(
        new Big(finalAnswerPercentage),
        balances.map(balance => balance.shares),
      )
    : computeEarnedCollateral(
        payouts,
        balances.map(balance => balance.shares),
      )

  const hasWinningOutcomes = earnedCollateral && !isDust(earnedCollateral, collateralToken.decimals)

  const { userWinningOutcomes, userWinningShares, winningOutcomes } = calcUserWinningsData(
    isScalar,
    balances.map(balance => balance.shares),
    payouts,
    Number(finalAnswerPercentage),
  )

  const EPS = 0.01

  let invalid = false

  if (isScalar) {
    if (realitioAnswer?.eq(new BigNumber(INVALID_ANSWER_ID))) {
      invalid = true
    } else {
      invalid = false
    }
  } else {
    invalid = payouts
      ? payouts.every(payout =>
          payout
            .sub(1 / payouts.length)
            .abs()
            .lte(EPS),
        )
      : false
  }

  const symbol = useSymbol(collateralToken)
  let redeemString = 'NaN'
  let balanceString = ''
  if (earnedCollateral) {
    if (isCToken(marketCollateralToken.symbol)) {
      const baseToken = getBaseToken(networkId, collateralToken.symbol)
      redeemString = `${formatBigNumber(displayEarnedCollateral, baseToken.decimals)} ${baseToken.symbol}`
    } else {
      redeemString = `${formatBigNumber(earnedCollateral, collateralToken.decimals)} ${symbol}`
    }
  }
  const nativeAsset = getNativeAsset(networkId, relay)
  if (userRealitioWithdraw) {
    balanceString = `${formatBigNumber(userRealitioBalance, nativeAsset.decimals)} ${nativeAsset.symbol}`
  } else if (cpkRealitioWithdraw) {
    balanceString = `${formatBigNumber(cpkRealitioBalance, nativeAsset.decimals)} ${nativeAsset.symbol}`
  }

  return (
    <>
      <TopCard>
        <MarketTopDetailsClosed
          collateral={collateral}
          compoundService={compoundService}
          marketMakerData={marketMakerData}
        />
      </TopCard>
      <BottomCard>
        <MarketNavigation
          activeTab={currentTab}
          hasWinningOutcomes={hasWinningOutcomes}
          marketMakerData={marketMakerData}
          switchMarketTab={switchMarketTab}
        ></MarketNavigation>
        {currentTab === MarketDetailsTab.swap && (
          <>
            {isScalar ? (
              <MarketScale
                borderTop={true}
                collateral={props.marketMakerData.collateral}
                currentAnswer={props.marketMakerData.question.currentAnswer}
                currentAnswerBond={props.marketMakerData.question.currentAnswerBond}
                currentPrediction={unclampedFinalAnswerPercentage.toString()}
                isClosed={true}
                lowerBound={scalarLow || new BigNumber(0)}
                outcomePredictedByMarket={
                  props.marketMakerData.outcomeTokenMarginalPrices
                    ? props.marketMakerData.outcomeTokenMarginalPrices[1]
                    : null
                }
                startingPointTitle={'Final answer'}
                unit={getUnit(question.title)}
                upperBound={scalarHigh || new BigNumber(0)}
              />
            ) : (
              <OutcomeTable
                balances={balances}
                collateral={collateralToken}
                disabledColumns={disabledColumns}
                displayRadioSelection={false}
                payouts={payouts}
                probabilities={probabilities}
                withWinningOutcome={true}
              />
            )}
            <WhenConnected>
              {(hasWinningOutcomes || userRealitioWithdraw || cpkRealitioWithdraw) && (
                <MarketResolutionMessageStyled
                  arbitrator={arbitrator}
                  balanceString={balanceString}
                  collateralToken={collateralToken}
                  invalid={invalid}
                  realitioWithdraw={userRealitioWithdraw || cpkRealitioWithdraw}
                  redeemString={redeemString}
                  userWinningOutcomes={userWinningOutcomes}
                  userWinningShares={userWinningShares}
                  winningOutcomes={winningOutcomes}
                ></MarketResolutionMessageStyled>
              )}
              {isConditionResolved && !hasWinningOutcomes && !userRealitioWithdraw && !cpkRealitioWithdraw ? (
                <StyledButtonContainer>
                  <Button
                    buttonType={ButtonType.secondaryLine}
                    onClick={() => {
                      history.goBack()
                    }}
                  >
                    Back
                  </Button>
                  {buySellButtons}
                </StyledButtonContainer>
              ) : (
                <>
                  <BorderedButtonContainer
                    borderTop={
                      (hasWinningOutcomes !== null && hasWinningOutcomes) || userRealitioWithdraw || cpkRealitioWithdraw
                    }
                  >
                    <Button
                      buttonType={ButtonType.primary}
                      disabled={status === Status.Loading}
                      onClick={
                        userRealitioWithdraw
                          ? !isConditionResolved
                            ? resolveCondition
                            : claimBond
                          : hasWinningOutcomes || cpkRealitioWithdraw
                          ? redeem
                          : resolveCondition
                      }
                    >
                      {userRealitioWithdraw
                        ? !isConditionResolved
                          ? 'Resolve Condition'
                          : 'Redeem Bond'
                        : hasWinningOutcomes || cpkRealitioWithdraw
                        ? 'Redeem'
                        : !isConditionResolved
                        ? 'Resolve Condition'
                        : ''}
                    </Button>
                  </BorderedButtonContainer>
                </>
              )}
            </WhenConnected>
          </>
        )}
        {currentTab === MarketDetailsTab.pool && (
          <MarketPoolLiquidityContainer
            fetchGraphMarketMakerData={fetchGraphMarketMakerData}
            fetchGraphMarketUserTxData={fetchGraphMarketUserTxData}
            isScalar={isScalar}
            marketMakerData={marketMakerData}
            switchMarketTab={switchMarketTab}
          />
        )}
        {currentTab === MarketDetailsTab.history && <MarketHistoryContainer marketMakerData={marketMakerData} />}
        {currentTab === MarketDetailsTab.buy && (
          <MarketBuyContainer
            fetchGraphMarketMakerData={fetchGraphMarketMakerData}
            fetchGraphMarketUserTxData={fetchGraphMarketUserTxData}
            isScalar={isScalar}
            marketMakerData={marketMakerData}
            switchMarketTab={switchMarketTab}
          />
        )}
        {currentTab === MarketDetailsTab.sell && (
          <MarketSellContainer
            currentTab={currentTab}
            fetchGraphMarketMakerData={fetchGraphMarketMakerData}
            fetchGraphMarketUserTxData={fetchGraphMarketUserTxData}
            isScalar={isScalar}
            marketMakerData={marketMakerData}
            switchMarketTab={switchMarketTab}
          />
        )}
      </BottomCard>
      <ModalTransactionWrapper
        confirmations={0}
        confirmationsRequired={0}
        isOpen={isTransactionModalOpen}
        message={message}
        onClose={() => setIsTransactionModalOpen(false)}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}

export const ClosedMarketDetails = withRouter(Wrapper)
