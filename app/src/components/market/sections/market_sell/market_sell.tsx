import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { useEffect, useMemo, useState } from 'react'
import { RouteComponentProps, withRouter } from 'react-router-dom'
import ReactTooltip from 'react-tooltip'
import styled from 'styled-components'

import { STANDARD_DECIMALS } from '../../../../common/constants'
import { useAsyncDerivedValue, useConnectedWeb3Context, useContracts } from '../../../../hooks'
import { MarketMakerService } from '../../../../services'
import { getLogger } from '../../../../util/logger'
import {
  bigNumberToNumber,
  bigNumberToString,
  calcSellAmountInCollateral,
  computeBalanceAfterTrade,
  getInitialCollateral,
  mulBN,
} from '../../../../util/tools'
import {
  BalanceItem,
  MarketDetailsTab,
  MarketMakerData,
  OutcomeTableValue,
  Status,
  Token,
  TransactionStep,
} from '../../../../util/types'
import { Button, ButtonContainer } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { BigNumberInput, TextfieldCustomPlaceholder } from '../../../common'
import { BigNumberInputReturn } from '../../../common/form/big_number_input'
import { ModalTransactionWrapper } from '../../../modal'
import { GenericError } from '../../common/common_styled'
import { GridTransactionDetails } from '../../common/grid_transaction_details'
import { OutcomeTable } from '../../common/outcome_table'
import { TokenBalance } from '../../common/token_balance'
import { TransactionDetailsCard } from '../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../common/transaction_details_row'
import { WarningMessage } from '../../common/warning_message'

const StyledButtonContainer = styled(ButtonContainer)`
  justify-content: space-between;
  margin: 0 -24px;
  padding: 20px 24px 0;
  margin-top: ${({ theme }) => theme.borders.borderLineDisabled};
`

const logger = getLogger('Market::Sell')

interface Props extends RouteComponentProps<any> {
  fetchGraphMarketMakerData: () => Promise<void>
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
}

const MarketSellWrapper: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { cpk, networkId, relay } = context
  const { fetchBalances } = context.balances
  const { buildMarketMaker, conditionalTokens } = useContracts(context)
  const { fetchGraphMarketMakerData, marketMakerData, switchMarketTab } = props
  const { address: marketMakerAddress, balances, fee } = marketMakerData

  const marketMaker = buildMarketMaker(marketMakerAddress)

  const initialCollateral = getInitialCollateral(networkId, marketMakerData.collateral, relay)
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  let defaultOutcomeIndex = 0
  for (let i = 0; i < balances.length; i++) {
    const shares = bigNumberToNumber(balances[i].shares, collateral.decimals)
    if (shares > 0) {
      defaultOutcomeIndex = i
      break
    }
  }

  const [status, setStatus] = useState<Status>(Status.Ready)
  const [outcomeIndex, setOutcomeIndex] = useState<number>(defaultOutcomeIndex)
  const [balanceItem, setBalanceItem] = useState<BalanceItem>(balances[outcomeIndex])
  const [amountShares, setAmountShares] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountSharesToDisplay, setAmountSharesToDisplay] = useState<string>('')
  const [displaySellShares, setDisplaySellShares] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [isNegativeAmountShares, setIsNegativeAmountShares] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [isTransactionProcessing, setIsTransactionProcessing] = useState<boolean>(false)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')

  const marketFeeWithTwoDecimals = bigNumberToNumber(fee, STANDARD_DECIMALS)

  useEffect(() => {
    setIsNegativeAmountShares(bigNumberToNumber(amountShares || Zero, collateral.decimals) < 0)
  }, [amountShares, collateral.decimals])

  useEffect(() => {
    setBalanceItem(balances[outcomeIndex])
    // eslint-disable-next-line
  }, [balances[outcomeIndex]])

  useEffect(() => {
    setOutcomeIndex(defaultOutcomeIndex)
    setBalanceItem(balances[defaultOutcomeIndex])
    setAmountShares(null)
    setAmountSharesToDisplay('')
    setCollateral(initialCollateral)
    // eslint-disable-next-line
  }, [marketMakerData.collateral.address])

  const calcSellAmount = useMemo(
    () => async (
      amountShares: BigNumber,
    ): Promise<[number[], Maybe<BigNumber>, Maybe<BigNumber>, Maybe<BigNumber>]> => {
      const holdings = balances.map(balance => balance.holdings)
      const holdingsOfSoldOutcome = holdings[outcomeIndex]
      const holdingsOfOtherOutcomes = holdings.filter((item, index) => {
        return index !== outcomeIndex
      })
      const amountToSell = calcSellAmountInCollateral(
        // Round down in case of precision error
        amountShares.mul(99999999).div(100000000),
        holdingsOfSoldOutcome,
        holdingsOfOtherOutcomes,
        marketFeeWithTwoDecimals,
      )

      if (!amountToSell) {
        logger.warn(
          `Could not compute amount of collateral to sell for '${amountShares.toString()}' and '${holdingsOfSoldOutcome.toString()}'`,
        )
        return [[], null, null, null]
      }

      const balanceAfterTrade = computeBalanceAfterTrade(
        holdings,
        outcomeIndex,
        amountToSell.mul(-1), // negate amounts because it's a sale
        amountShares.mul(-1),
      )

      const pricesAfterTrade = MarketMakerService.getActualPrice(balanceAfterTrade)
      const potentialValue = mulBN(amountToSell, 1 / (1 - marketFeeWithTwoDecimals))
      const costFee = potentialValue.sub(amountToSell)
      const probabilities = pricesAfterTrade.map(priceAfterTrade => priceAfterTrade * 100)
      logger.log(`Amount to sell ${amountToSell}`)
      return [probabilities, costFee, amountToSell, potentialValue]
    },
    [outcomeIndex, balances, marketFeeWithTwoDecimals],
  )

  const [probabilities, costFee, tradedCollateral, potentialValue] = useAsyncDerivedValue(
    amountShares || Zero,
    [balances.map(() => 0), null, null, null],
    calcSellAmount,
  )

  const finish = async () => {
    try {
      if (!tradedCollateral) {
        return
      }

      if (!cpk) {
        return
      }
      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionProcessing(true)
      setIsTransactionModalOpen(true)
      const sharesAmount = bigNumberToString(amountShares || Zero, collateral.decimals)

      setStatus(Status.Loading)
      setMessage(`Selling ${sharesAmount} shares...`)

      await cpk.sellOutcomes({
        amount: tradedCollateral,
        outcomeIndex,
        marketMaker,
        conditionalTokens,
        setTxHash,
        setTxState,
      })

      await fetchGraphMarketMakerData()
      await fetchBalances()
      setAmountSharesFromInput(new BigNumber('0'))
      setDisplaySellShares(null)
      setAmountShares(null)
      setStatus(Status.Ready)
      setMessage(`Successfully sold ${sharesAmount} ${balances[outcomeIndex].outcomeName} shares.`)
      setIsTransactionProcessing(false)
    } catch (err) {
      setStatus(Status.Error)
      setTxState(TransactionStep.error)
      setMessage(`Error trying to sell '${balances[outcomeIndex].outcomeName}' shares.`)
      logger.error(`${message} - ${err.message}`)
      setIsTransactionProcessing(false)
    }
  }

  const newShares = balances.map((balance, i) =>
    i === outcomeIndex ? balance.shares.sub(amountShares || Zero) : balance.shares,
  )

  const selectedOutcomeBalance = bigNumberToString(balanceItem.shares, collateral.decimals)

  const amountError = isTransactionProcessing
    ? null
    : balanceItem.shares === null
    ? null
    : balanceItem.shares.isZero() && amountShares?.gt(balanceItem.shares)
    ? `Insufficient balance`
    : amountShares?.gt(balanceItem.shares)
    ? `Value must be less than or equal to ${selectedOutcomeBalance} shares`
    : null

  const setAmountSharesFromInput = (shares: BigNumber) => {
    setAmountShares(shares)
    setDisplaySellShares(shares)
  }

  const sellAmountSharesDisplay = bigNumberToString(amountShares || Zero, collateral.decimals)

  const isSellButtonDisabled =
    !amountShares ||
    (status !== Status.Ready && status !== Status.Error) ||
    amountShares?.isZero() ||
    amountError !== null ||
    isNegativeAmountShares

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
        outcomeHandleChange={(value: number) => {
          setOutcomeIndex(value)
          setBalanceItem(balances[value])
        }}
        outcomeSelected={outcomeIndex}
        probabilities={probabilities}
        showPriceChange={amountShares?.gt(0)}
        showSharesChange={amountShares?.gt(0)}
      />
      <GridTransactionDetails>
        <div>
          <TokenBalance text="Your Shares" value={selectedOutcomeBalance} />
          <ReactTooltip id="walletBalanceTooltip" />
          <TextfieldCustomPlaceholder
            formField={
              <BigNumberInput
                decimals={collateral.decimals}
                name="amount"
                onChange={(e: BigNumberInputReturn) => {
                  setAmountSharesFromInput(e.value)
                  setAmountSharesToDisplay('')
                }}
                style={{ width: 0 }}
                value={displaySellShares}
                valueToDisplay={amountSharesToDisplay}
              />
            }
            onClickMaxButton={() => {
              setAmountSharesFromInput(balanceItem.shares)
              setAmountSharesToDisplay(bigNumberToString(balanceItem.shares, collateral.decimals, 5, true))
            }}
            shouldDisplayMaxButton
            symbol={'Shares'}
          />
          {amountError && <GenericError>{amountError}</GenericError>}
        </div>
        <div>
          <TransactionDetailsCard>
            <TransactionDetailsRow title={'Sell Amount'} value={`${sellAmountSharesDisplay} Shares`} />
            <TransactionDetailsRow
              emphasizeValue={potentialValue ? potentialValue.gt(0) : false}
              state={ValueStates.success}
              title={'Profit'}
              value={
                potentialValue
                  ? `${bigNumberToString(potentialValue, collateral.decimals)} 
                  ${collateral.symbol}`
                  : '0.00'
              }
            />
            <TransactionDetailsRow
              title={'Trading Fee'}
              value={`${
                costFee ? bigNumberToString(costFee.mul(-1), collateral.decimals, collateral.decimals) : '0.00'
              } ${collateral.symbol}`}
            />
            <TransactionDetailsLine />
            <TransactionDetailsRow
              emphasizeValue={
                (tradedCollateral && bigNumberToNumber(tradedCollateral, collateral.decimals) > 0) || false
              }
              state={
                (tradedCollateral &&
                  bigNumberToNumber(tradedCollateral, collateral.decimals) > 0 &&
                  ValueStates.important) ||
                ValueStates.normal
              }
              title={'Total'}
              value={`${tradedCollateral ? bigNumberToNumber(tradedCollateral, collateral.decimals) : '0.00'} ${
                collateral.symbol
              }`}
            />
          </TransactionDetailsCard>
        </div>
      </GridTransactionDetails>
      {isNegativeAmountShares && (
        <WarningMessage
          additionalDescription={''}
          danger={true}
          description={`Your sell amount should not be negative.`}
          href={''}
          hyperlinkDescription={''}
          marginBottom={true}
        />
      )}
      <StyledButtonContainer borderTop={true} marginTop={isNegativeAmountShares}>
        <Button buttonType={ButtonType.secondaryLine} onClick={() => switchMarketTab(MarketDetailsTab.swap)}>
          Cancel
        </Button>
        <Button buttonType={ButtonType.secondaryLine} disabled={isSellButtonDisabled} onClick={() => finish()}>
          Sell
        </Button>
      </StyledButtonContainer>
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

export const MarketSell = withRouter(MarketSellWrapper)
