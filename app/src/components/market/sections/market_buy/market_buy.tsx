import { stripIndents } from 'common-tags'
import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { useEffect, useMemo, useState } from 'react'
import { RouteComponentProps, withRouter } from 'react-router-dom'
import ReactTooltip from 'react-tooltip'
import styled from 'styled-components'

import { DOCUMENT_VALIDITY_RULES } from '../../../../common/constants'
import {
  useAsyncDerivedValue,
  useCollateralBalance,
  useConnectedCPKContext,
  useConnectedWeb3Context,
  useContracts,
  useCpkAllowance,
  useCpkProxy,
  useSymbol,
} from '../../../../hooks'
import { MarketMakerService } from '../../../../services'
import { getLogger } from '../../../../util/logger'
import { getNativeAsset, getWrapToken, pseudoNativeAssetAddress } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import { computeBalanceAfterTrade, formatBigNumber, formatNumber, mulBN } from '../../../../util/tools'
import { MarketDetailsTab, MarketMakerData, OutcomeTableValue, Status, Ternary, Token } from '../../../../util/types'
import { Button, ButtonContainer } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { BigNumberInput, TextfieldCustomPlaceholder } from '../../../common'
import { BigNumberInputReturn } from '../../../common/form/big_number_input'
import { FullLoading } from '../../../loading'
import { ModalTransactionResult } from '../../../modal/modal_transaction_result'
import { CurrenciesWrapper, GenericError } from '../../common/common_styled'
import { CurrencySelector } from '../../common/currency_selector'
import { GridTransactionDetails } from '../../common/grid_transaction_details'
import { OutcomeTable } from '../../common/outcome_table'
import { SetAllowance } from '../../common/set_allowance'
import { TransactionDetailsCard } from '../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../common/transaction_details_row'
import { WarningMessage } from '../../common/warning_message'

const WarningMessageStyled = styled(WarningMessage)`
  margin-top: 20px;
  margin-bottom: 0;
`

const StyledButtonContainer = styled(ButtonContainer)`
  justify-content: space-between;
  margin: 0 -24px;

  padding: 20px 24px 0;
  margin-top: ${({ theme }) => theme.borders.borderLineDisabled};
`

const logger = getLogger('Market::Buy')

interface Props extends RouteComponentProps<any> {
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
  fetchGraphMarketMakerData: () => Promise<void>
}

const MarketBuyWrapper: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const cpk = useConnectedCPKContext()

  const { library: provider, networkId } = context
  const signer = useMemo(() => provider.getSigner(), [provider])

  const { buildMarketMaker } = useContracts(context)
  const { fetchGraphMarketMakerData, marketMakerData, switchMarketTab } = props
  const { address: marketMakerAddress, balances, fee, question } = marketMakerData
  const marketMaker = useMemo(() => buildMarketMaker(marketMakerAddress), [buildMarketMaker, marketMakerAddress])

  const wrapToken = getWrapToken(networkId)
  const nativeAsset = getNativeAsset(networkId)
  const initialCollateral =
    marketMakerData.collateral.address.toLowerCase() === wrapToken.address.toLowerCase()
      ? nativeAsset
      : marketMakerData.collateral
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  const symbol = useSymbol(collateral)

  const [status, setStatus] = useState<Status>(Status.Ready)
  const [outcomeIndex, setOutcomeIndex] = useState<number>(0)
  const [amount, setAmount] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToDisplay, setAmountToDisplay] = useState<string>('')
  const [isNegativeAmount, setIsNegativeAmount] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [isModalTransactionResultOpen, setIsModalTransactionResultOpen] = useState(false)
  const [tweet, setTweet] = useState('')
  const [newShares, setNewShares] = useState<Maybe<BigNumber[]>>(null)

  const [allowanceFinished, setAllowanceFinished] = useState(false)
  const { allowance, unlock } = useCpkAllowance(signer, collateral.address)

  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(amount || Zero))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())

  const [upgradeFinished, setUpgradeFinished] = useState(false)
  const { proxyIsUpToDate, updateProxy } = useCpkProxy()
  const isUpdated = RemoteData.hasData(proxyIsUpToDate) ? proxyIsUpToDate.data : true

  useEffect(() => {
    setIsNegativeAmount(formatBigNumber(amount || Zero, collateral.decimals).includes('-'))
  }, [amount, collateral.decimals])

  useEffect(() => {
    setCollateral(initialCollateral)
    setAmount(null)
    setAmountToDisplay('')
    // eslint-disable-next-line
  }, [marketMakerData.collateral.address])

  // get the amount of shares that will be traded and the estimated prices after trade
  const calcBuyAmount = useMemo(
    () => async (amount: BigNumber): Promise<[BigNumber, number[], BigNumber]> => {
      let tradedShares: BigNumber
      try {
        tradedShares = await marketMaker.calcBuyAmount(amount, outcomeIndex)
      } catch {
        tradedShares = new BigNumber(0)
      }
      const balanceAfterTrade = computeBalanceAfterTrade(
        balances.map(b => b.holdings),
        outcomeIndex,
        amount,
        tradedShares,
      )
      const pricesAfterTrade = MarketMakerService.getActualPrice(balanceAfterTrade)

      const probabilities = pricesAfterTrade.map(priceAfterTrade => priceAfterTrade * 100)

      setNewShares(
        balances.map((balance, i) => (i === outcomeIndex ? balance.shares.add(tradedShares) : balance.shares)),
      )

      return [tradedShares, probabilities, amount]
    },
    [balances, marketMaker, outcomeIndex],
  )

  const [tradedShares, probabilities, debouncedAmount] = useAsyncDerivedValue(
    amount || Zero,
    [new BigNumber(0), balances.map(() => 0), amount],
    calcBuyAmount,
  )

  const { collateralBalance: maybeCollateralBalance, fetchCollateralBalance } = useCollateralBalance(
    collateral,
    context,
  )
  const collateralBalance = maybeCollateralBalance || Zero

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()
    setAllowanceFinished(true)
  }

  const showUpgrade =
    (!isUpdated && collateral.address === pseudoNativeAssetAddress) ||
    (upgradeFinished && collateral.address === pseudoNativeAssetAddress)

  const shouldDisplayMaxButton = collateral.address !== pseudoNativeAssetAddress

  const upgradeProxy = async () => {
    if (!cpk) {
      return
    }

    await updateProxy()
    setUpgradeFinished(true)
  }

  const finish = async () => {
    try {
      if (!cpk) {
        return
      }

      const sharesAmount = formatBigNumber(tradedShares, collateral.decimals)

      setStatus(Status.Loading)
      setMessage(`Buying ${sharesAmount} shares ...`)

      await cpk.buyOutcomes({
        amount: amount || Zero,
        collateral,
        outcomeIndex,
        marketMaker,
      })

      await fetchGraphMarketMakerData()
      await fetchCollateralBalance()

      setTweet(
        stripIndents(`${question.title}

      I predict ${balances[outcomeIndex].outcomeName}

      What do you think?`),
      )
      setAmount(null)
      setAmountToDisplay('')
      setStatus(Status.Ready)
      setMessage(`Successfully bought ${sharesAmount} '${balances[outcomeIndex].outcomeName}' shares.`)
    } catch (err) {
      setStatus(Status.Error)
      setMessage(`Error trying to buy '${balances[outcomeIndex].outcomeName}' Shares.`)
      logger.error(`${message} - ${err.message}`)
    }
    setIsModalTransactionResultOpen(true)
  }

  const showSetAllowance =
    collateral.address !== pseudoNativeAssetAddress &&
    !cpk?.cpk.isSafeApp() &&
    (allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False)

  const feePaid = mulBN(debouncedAmount || Zero, Number(formatBigNumber(fee, 18, 4)))
  const feePercentage = Number(formatBigNumber(fee, 18, 4)) * 100

  const baseCost = debouncedAmount?.sub(feePaid)
  const potentialProfit = tradedShares.isZero() ? new BigNumber(0) : tradedShares.sub(amount || Zero)

  const currentBalance = `${formatBigNumber(collateralBalance, collateral.decimals, 5)}`
  const feeFormatted = `${formatNumber(formatBigNumber(feePaid.mul(-1), collateral.decimals))} ${symbol}`
  const baseCostFormatted = `${formatNumber(formatBigNumber(baseCost || Zero, collateral.decimals))} ${symbol}`
  const potentialProfitFormatted = `${formatNumber(formatBigNumber(potentialProfit, collateral.decimals))} ${symbol}`
  const sharesTotal = formatNumber(formatBigNumber(tradedShares, collateral.decimals))
  const total = `${sharesTotal} Shares`

  const amountError =
    maybeCollateralBalance === null
      ? null
      : maybeCollateralBalance.isZero() && amount?.gt(maybeCollateralBalance)
      ? `Insufficient balance`
      : amount?.gt(maybeCollateralBalance)
      ? `Value must be less than or equal to ${currentBalance} ${symbol}`
      : null

  const isBuyDisabled =
    !amount ||
    (status !== Status.Ready && status !== Status.Error) ||
    amount?.isZero() ||
    (!cpk?.cpk.isSafeApp() && collateral.address !== pseudoNativeAssetAddress && hasEnoughAllowance !== Ternary.True) ||
    amountError !== null ||
    isNegativeAmount ||
    (!isUpdated && collateral.address === pseudoNativeAssetAddress)

  const currencyFilters =
    collateral.address === wrapToken.address || collateral.address === pseudoNativeAssetAddress
      ? [wrapToken.address.toLowerCase(), pseudoNativeAssetAddress.toLowerCase()]
      : []

  const switchOutcome = (value: number) => {
    setNewShares(balances.map((balance, i) => (i === outcomeIndex ? balance.shares.add(tradedShares) : balance.shares)))
    setOutcomeIndex(value)
  }

  return (
    <>
      <OutcomeTable
        balances={balances}
        collateral={collateral}
        disabledColumns={[
          OutcomeTableValue.Payout,
          OutcomeTableValue.Outcome,
          OutcomeTableValue.Probability,
          OutcomeTableValue.Bonded,
        ]}
        newShares={newShares}
        outcomeHandleChange={(value: number) => switchOutcome(value)}
        outcomeSelected={outcomeIndex}
        probabilities={probabilities}
        showPriceChange={amount?.gt(0)}
        showSharesChange={amount?.gt(0)}
      />
      <WarningMessageStyled
        additionalDescription={'. Be aware that market makers may remove liquidity from the market at any time!'}
        description={
          "Before trading on a market, make sure that its outcome will be known by its resolution date and it isn't an"
        }
        href={DOCUMENT_VALIDITY_RULES}
        hyperlinkDescription={'invalid market'}
      />
      <GridTransactionDetails>
        <div>
          <CurrenciesWrapper>
            <CurrencySelector
              addBalances
              addNativeAsset
              balance={formatBigNumber(maybeCollateralBalance || Zero, collateral.decimals, 5)}
              context={context}
              currency={collateral.address}
              disabled={currencyFilters.length ? false : true}
              filters={currencyFilters}
              onSelect={(token: Token | null) => {
                if (token) {
                  setCollateral(token)
                  setAmount(new BigNumber(0))
                  setAmountToDisplay('')
                }
              }}
            />
          </CurrenciesWrapper>
          <ReactTooltip id="walletBalanceTooltip" />

          <TextfieldCustomPlaceholder
            formField={
              <BigNumberInput
                decimals={collateral.decimals}
                name="amount"
                onChange={(e: BigNumberInputReturn) => {
                  setAmount(e.value)
                  setAmountToDisplay('')
                }}
                style={{ width: 0 }}
                value={amount}
                valueToDisplay={amountToDisplay}
              />
            }
            onClickMaxButton={() => {
              setAmount(collateralBalance)
              setAmountToDisplay(formatBigNumber(collateralBalance, collateral.decimals, 5))
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
              tooltip={`A ${feePercentage}% fee goes to liquidity providers.`}
              value={feeFormatted}
            />
            <TransactionDetailsLine />
            <TransactionDetailsRow
              emphasizeValue={potentialProfit.gt(0)}
              state={ValueStates.success}
              title={'Potential Profit'}
              value={potentialProfitFormatted}
            />
            <TransactionDetailsRow
              emphasizeValue={parseFloat(sharesTotal) > 0}
              state={(parseFloat(sharesTotal) > 0 && ValueStates.important) || ValueStates.normal}
              title={'Total'}
              value={total}
            />
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
          marginBottom={!showSetAllowance}
        />
      )}
      {showSetAllowance && (
        <SetAllowance
          collateral={collateral}
          finished={allowanceFinished && RemoteData.is.success(allowance)}
          loading={RemoteData.is.asking(allowance)}
          onUnlock={unlockCollateral}
        />
      )}
      {showUpgrade && (
        <SetAllowance
          collateral={nativeAsset}
          finished={upgradeFinished && RemoteData.is.success(proxyIsUpToDate)}
          loading={RemoteData.is.asking(proxyIsUpToDate)}
          onUnlock={upgradeProxy}
        />
      )}
      <StyledButtonContainer borderTop={true} marginTop={showSetAllowance || showUpgrade || isNegativeAmount}>
        <Button buttonType={ButtonType.secondaryLine} onClick={() => switchMarketTab(MarketDetailsTab.swap)}>
          Cancel
        </Button>
        <Button buttonType={ButtonType.secondaryLine} disabled={isBuyDisabled} onClick={() => finish()}>
          Buy
        </Button>
      </StyledButtonContainer>
      <ModalTransactionResult
        isOpen={isModalTransactionResultOpen}
        onClose={() => setIsModalTransactionResultOpen(false)}
        shareUrl={`${window.location.protocol}//${window.location.hostname}/#/${marketMakerAddress}`}
        status={status}
        text={message}
        title={status === Status.Error ? 'Transaction Error' : 'Buy Shares'}
        tweet={tweet}
      />
      {status === Status.Loading && <FullLoading message={message} />}
    </>
  )
}

export const MarketBuy = withRouter(MarketBuyWrapper)
