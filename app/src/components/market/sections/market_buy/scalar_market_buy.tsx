import { stripIndents } from 'common-tags'
import { Zero } from 'ethers/constants'
import { BigNumber, parseUnits } from 'ethers/utils'
import React, { useEffect, useMemo, useState } from 'react'
import ReactTooltip from 'react-tooltip'
import styled from 'styled-components'

import { STANDARD_DECIMALS } from '../../../../common/constants'
import {
  useAsyncDerivedValue,
  useCollateralBalance,
  useConnectedWeb3Context,
  useContracts,
  useCpkAllowance,
  useCpkProxy,
} from '../../../../hooks'
import { SharedPropsInterface } from '../../../../pages/MarkeBuyContainerV2'
import { MarketMakerService } from '../../../../services'
import { getLogger } from '../../../../util/logger'
import { getNativeAsset, pseudoNativeAssetAddress } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import {
  calcPrediction,
  calcXValue,
  computeBalanceAfterTrade,
  formatBigNumber,
  formatNumber,
  getInitialCollateral,
  getUnit,
  mulBN,
} from '../../../../util/tools'
import { MarketDetailsTab, MarketMakerData, Status, Ternary, Token, TransactionStep } from '../../../../util/types'
import { Button, ButtonContainer, ButtonTab } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { BigNumberInput, TextfieldCustomPlaceholder } from '../../../common'
import { BigNumberInputReturn } from '../../../common/form/big_number_input'
import { ModalTransactionWrapper } from '../../../modal'
import { CurrenciesWrapper, GenericError, TabsGrid } from '../../common/common_styled'
import { CurrencySelector } from '../../common/currency_selector'
import { GridTransactionDetails } from '../../common/grid_transaction_details'
import { MarketScale } from '../../common/market_scale'
import { SetAllowance } from '../../common/set_allowance'
import { TransactionDetailsCard } from '../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../common/transaction_details_row'
import { WarningMessage } from '../../common/warning_message'

const StyledButtonContainer = styled(ButtonContainer)`
  justify-content: space-between;
  border-top: 1px solid ${props => props.theme.borders.borderDisabled};
  margin-left: -25px;
  margin-right: -25px;
  padding-left: 25px;
  padding-right: 25px;
`

const logger = getLogger('Scalar Market::Buy')

interface Props {
  fetchGraphMarketMakerData: () => Promise<void>
  fetchGraphMarketUserTxData: () => Promise<void>
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
  sharedProps: SharedPropsInterface
}

export const ScalarMarketBuy = (props: Props) => {
  const { fetchGraphMarketMakerData, fetchGraphMarketUserTxData, marketMakerData, sharedProps, switchMarketTab } = props
  const {
    amount,
    baseCost,
    feePaid,
    marketMaker,
    outcomeIndex: positionIndex,
    potentialProfit,
    probabilitiesOrNewPrediction: newPrediction,
    setAmount,
    setOutcomeIndex: setPositionIndex,
    sharesTotal,
    tradedShares,
  } = sharedProps
  const context = useConnectedWeb3Context()
  const { fetchBalances } = context.balances

  const { cpk, library: provider, networkId, relay } = context
  const signer = useMemo(() => provider.getSigner(), [provider])

  const {
    address: marketMakerAddress,

    balances,
    fee,
    outcomeTokenMarginalPrices,
    question,
    scalarHigh,
    scalarLow,
  } = marketMakerData

  const Tabs = {
    short: 'short',
    long: 'long',
  }

  //const [amount, setAmount] = useState<BigNumber>(new BigNumber(0))
  const [amountDisplay, setAmountDisplay] = useState<string>('')

  const nativeAsset = getNativeAsset(networkId, relay)
  const initialCollateral = getInitialCollateral(networkId, marketMakerData.collateral, relay)
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  const [activeTab, setActiveTab] = useState(Tabs.short)
  //const [positionIndex, setPositionIndex] = useState(0)
  const [status, setStatus] = useState<Status>(Status.Ready)
  const [isNegativeAmount, setIsNegativeAmount] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [tweet, setTweet] = useState('')
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')

  const [allowanceFinished, setAllowanceFinished] = useState(false)

  const [displayFundAmount, setDisplayFundAmount] = useState<Maybe<BigNumber>>(new BigNumber(0))

  const { allowance, unlock } = useCpkAllowance(signer, collateral.address)
  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(amount))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())

  const { collateralBalance: maybeCollateralBalance, fetchCollateralBalance } = useCollateralBalance(
    collateral,
    context,
  )
  const collateralBalance = maybeCollateralBalance || Zero

  useEffect(() => {
    setCollateral(initialCollateral)
    setAmount(new BigNumber(0))
    setAmountDisplay('')
    // eslint-disable-next-line
  }, [marketMakerData.collateral.address])

  useEffect(() => {
    setIsNegativeAmount(formatBigNumber(amount, collateral.decimals, collateral.decimals).includes('-'))
  }, [amount, collateral.decimals])

  useEffect(() => {
    activeTab === Tabs.short ? setPositionIndex(0) : setPositionIndex(1)
  }, [activeTab, Tabs.short])

  const walletBalance = formatNumber(formatBigNumber(collateralBalance, collateral.decimals, 5), 5)

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()
    setAllowanceFinished(true)
  }

  const [upgradeFinished, setUpgradeFinished] = useState(false)
  const { proxyIsUpToDate, updateProxy } = useCpkProxy()
  const isUpdated = RemoteData.hasData(proxyIsUpToDate) ? proxyIsUpToDate.data : true

  const showUpgrade =
    (!isUpdated && collateral.address === pseudoNativeAssetAddress) ||
    (upgradeFinished && collateral.address === pseudoNativeAssetAddress)

  const upgradeProxy = async () => {
    if (!cpk) {
      return
    }

    await updateProxy()
    setUpgradeFinished(true)
  }

  const formattedNewPrediction =
    newPrediction &&
    calcXValue(
      parseUnits(newPrediction.toString(), STANDARD_DECIMALS),
      scalarLow || new BigNumber(0),
      scalarHigh || new BigNumber(0),
    ) / 100

  const feePercentage = Number(formatBigNumber(fee, STANDARD_DECIMALS, 4)) * 100

  const currentBalance = `${formatBigNumber(collateralBalance, collateral.decimals, 5)}`

  const feeFormatted = `${formatNumber(formatBigNumber(feePaid.mul(-1), collateral.decimals, collateral.decimals))}
  ${collateral.symbol}`
  const baseCostFormatted = `${formatNumber(
    formatBigNumber(baseCost || Zero, collateral.decimals, collateral.decimals),
  )}
  ${collateral.symbol}`
  const potentialProfitFormatted = `${formatNumber(
    formatBigNumber(potentialProfit, collateral.decimals, collateral.decimals),
  )} ${collateral.symbol}`

  const potentialLossFormatted = `${formatNumber(formatBigNumber(amount, collateral.decimals, collateral.decimals))} ${
    collateral.symbol
  }`

  const total = `${sharesTotal} Shares`

  const showSetAllowance =
    collateral.address !== pseudoNativeAssetAddress &&
    !cpk?.isSafeApp &&
    (allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False)

  const shouldDisplayMaxButton = collateral.address !== pseudoNativeAssetAddress

  const amountError =
    maybeCollateralBalance === null
      ? null
      : maybeCollateralBalance.isZero() && amount.gt(maybeCollateralBalance)
      ? `Insufficient balance`
      : amount.gt(maybeCollateralBalance)
      ? `Value must be less than or equal to ${currentBalance} ${collateral.symbol}`
      : null

  const isBuyDisabled =
    (status !== Status.Ready && status !== Status.Error) ||
    amount.isZero() ||
    (!cpk?.isSafeApp && collateral.address !== pseudoNativeAssetAddress && hasEnoughAllowance !== Ternary.True) ||
    amountError !== null ||
    isNegativeAmount ||
    (!isUpdated && collateral.address === pseudoNativeAssetAddress)

  const finish = async () => {
    const outcomeIndex = positionIndex
    try {
      if (!cpk) {
        return
      }

      const sharesAmount = formatBigNumber(tradedShares, collateral.decimals, collateral.decimals)
      setTweet('')
      setStatus(Status.Loading)
      setMessage(`Buying ${formatNumber(sharesAmount)} shares...`)
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)

      await cpk.buyOutcomes({
        amount: amount || Zero,
        collateral,
        outcomeIndex,
        marketMaker,
        setTxHash,
        setTxState,
      })

      await fetchGraphMarketUserTxData()
      await fetchGraphMarketMakerData()
      await fetchCollateralBalance()
      await fetchBalances()

      setTweet(
        stripIndents(`${question.title}

      I predict ${balances[outcomeIndex].outcomeName}

      What do you think?`),
      )
      setDisplayAmountToFund(new BigNumber('0'))
      setAmount(new BigNumber(0))
      setStatus(Status.Ready)
      setMessage(`Successfully bought ${formatNumber(sharesAmount)} ${balances[outcomeIndex].outcomeName} shares.`)
    } catch (err) {
      setStatus(Status.Error)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to buy '${balances[outcomeIndex].outcomeName}' Shares.`)
      logger.error(`${message} - ${err.message}`)
    }
  }

  const setDisplayAmountToFund = (value: BigNumber) => {
    setAmount(value)
    setDisplayFundAmount(value)
  }

  return (
    <>
      <MarketScale
        amountShares={tradedShares}
        borderTop={true}
        collateral={collateral}
        currentPrediction={outcomeTokenMarginalPrices[1]}
        fee={feePaid}
        long={activeTab === Tabs.long}
        lowerBound={scalarLow || new BigNumber(0)}
        newPrediction={formattedNewPrediction}
        short={activeTab === Tabs.short}
        startingPointTitle={'Current prediction'}
        tradeAmount={amount}
        unit={getUnit(question.title)}
        upperBound={scalarHigh || new BigNumber(0)}
      />
      <GridTransactionDetails>
        <div>
          <TabsGrid>
            <ButtonTab active={activeTab === Tabs.short} onClick={() => setActiveTab(Tabs.short)}>
              Short
            </ButtonTab>
            <ButtonTab active={activeTab === Tabs.long} onClick={() => setActiveTab(Tabs.long)}>
              Long
            </ButtonTab>
          </TabsGrid>
          <CurrenciesWrapper>
            <CurrencySelector
              addBalances
              addNativeAsset
              balance={walletBalance}
              context={context}
              currency={collateral.address}
              disabled
            />
          </CurrenciesWrapper>
          <ReactTooltip id="walletBalanceTooltip" />
          <TextfieldCustomPlaceholder
            formField={
              <BigNumberInput
                decimals={collateral.decimals}
                name="amount"
                onChange={(e: BigNumberInputReturn) => {
                  setDisplayAmountToFund(e.value.gt(Zero) ? e.value : Zero)
                  setAmountDisplay('')
                }}
                style={{ width: 0 }}
                value={displayFundAmount}
                valueToDisplay={amountDisplay}
              />
            }
            onClickMaxButton={() => {
              setDisplayAmountToFund(collateralBalance)
              setAmountDisplay(formatBigNumber(collateralBalance, collateral.decimals, 5))
            }}
            shouldDisplayMaxButton={shouldDisplayMaxButton}
            symbol={collateral.symbol}
          />
          {amountError && <GenericError>{amountError}</GenericError>}
        </div>
        <div>
          <TransactionDetailsCard>
            <TransactionDetailsRow title={'Base Cost'} value={baseCostFormatted} />
            <TransactionDetailsRow
              title={'Fee'}
              tooltip={`A ${feePercentage}% fee goes to liquidity providers`}
              value={feeFormatted}
            />
            <TransactionDetailsLine />
            <TransactionDetailsRow title={'Max. Loss'} value={potentialLossFormatted} />
            <TransactionDetailsRow
              emphasizeValue={potentialProfit.gt(0)}
              state={ValueStates.success}
              title={'Max. Profit'}
              value={potentialProfitFormatted}
            />
            <TransactionDetailsRow title={'Total'} value={total} />
          </TransactionDetailsCard>
        </div>
      </GridTransactionDetails>
      {isNegativeAmount && (
        <WarningMessage
          additionalDescription={''}
          danger={true}
          description={`Your buy amount should not be negative.`}
          href={''}
          hyperlinkDescription={''}
        />
      )}
      {showSetAllowance && (
        <SetAllowance
          collateral={collateral}
          finished={allowanceFinished && RemoteData.is.success(allowance)}
          loading={RemoteData.is.asking(allowance)}
          onUnlock={unlockCollateral}
          style={{ marginBottom: 20 }}
        />
      )}
      {showUpgrade && (
        <SetAllowance
          collateral={nativeAsset}
          finished={upgradeFinished && RemoteData.is.success(proxyIsUpToDate)}
          loading={RemoteData.is.asking(proxyIsUpToDate)}
          onUnlock={upgradeProxy}
          style={{ marginBottom: 20 }}
        />
      )}
      <StyledButtonContainer>
        <Button
          buttonType={ButtonType.secondaryLine}
          onClick={() => {
            switchMarketTab(MarketDetailsTab.swap)
          }}
        >
          Cancel
        </Button>
        <Button buttonType={ButtonType.primaryAlternative} disabled={isBuyDisabled} onClick={finish}>
          Buy Position
        </Button>
      </StyledButtonContainer>
      <ModalTransactionWrapper
        confirmations={0}
        confirmationsRequired={0}
        isOpen={isTransactionModalOpen}
        message={message}
        onClose={() => setIsTransactionModalOpen(false)}
        shareUrl={`${window.location.protocol}//${window.location.hostname}/#/${marketMakerAddress}`}
        tweet={tweet}
        txHash={txHash}
        txState={txState}
      />
    </>
  )
}
