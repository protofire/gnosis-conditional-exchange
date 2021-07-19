import Big from 'big.js'
import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { useEffect, useMemo, useState } from 'react'
import { useHistory } from 'react-router-dom'
import styled from 'styled-components'

import { DOCUMENT_FAQ, STANDARD_DECIMALS } from '../../../../common/constants'
import {
  useCollateralBalance,
  useConnectedWeb3Context,
  useContracts,
  useCpkAllowance,
  useCpkProxy,
  useFundingBalance,
} from '../../../../hooks'
import { getLogger } from '../../../../util/logger'
import { getNativeAsset, pseudoNativeAssetAddress } from '../../../../util/networks'
import { RemoteData } from '../../../../util/remote_data'
import {
  bigMax,
  bigMin,
  bigNumberToNumber,
  bigNumberToString,
  calcPoolTokens,
  calcRemoveFundingSendAmounts,
  getInitialCollateral,
  getUnit,
  isDust,
} from '../../../../util/tools'
import {
  AdditionalSharesType,
  MarketDetailsTab,
  MarketMakerData,
  Ternary,
  Token,
  TransactionStep,
} from '../../../../util/types'
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
import { TokenBalance } from '../../common/token_balance'
import { TransactionDetailsCard } from '../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../common/transaction_details_row'
import { WarningMessage } from '../../common/warning_message'

import { UserPoolData } from './user_pool_data'

const BottomButtonWrapper = styled(ButtonContainer)`
  justify-content: space-between;
  border-top: ${({ theme }) => theme.borders.borderLineDisabled};
  margin: 0 -24px;
  padding: 20px 24px 0;
`

const WarningMessageStyled = styled(WarningMessage)`
  margin-bottom: 0;
  margin-bottom: 24px;
`

const SetAllowanceStyled = styled(SetAllowance)`
  margin-bottom: 20px;
`

enum Tabs {
  deposit,
  withdraw,
}

interface Props {
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
  fetchGraphMarketMakerData: () => Promise<void>
  fetchGraphMarketUserTxData: () => Promise<void>
}

const logger = getLogger('Scalar Market::Fund')

export const ScalarMarketPoolLiquidity = (props: Props) => {
  const { fetchGraphMarketMakerData, fetchGraphMarketUserTxData, marketMakerData } = props
  const {
    address: marketMakerAddress,
    balances,
    fee,
    outcomeTokenAmounts,
    outcomeTokenMarginalPrices,
    question,
    scalarHigh,
    scalarLow,
    totalEarnings,
    totalPoolShares,
    userEarnings,
  } = marketMakerData
  const context = useConnectedWeb3Context()
  const history = useHistory()
  const { account, cpk, library: provider, networkId, relay } = context
  const { fetchBalances } = context.balances
  const { buildMarketMaker, conditionalTokens } = useContracts(context)
  const marketMaker = buildMarketMaker(marketMakerAddress)

  const { proxyIsUpToDate, updateProxy } = useCpkProxy()
  const isUpdated = RemoteData.hasData(proxyIsUpToDate) ? proxyIsUpToDate.data : true
  const [upgradeFinished, setUpgradeFinished] = useState(false)

  const resolutionDate = question.resolution.getTime()
  const currentDate = new Date().getTime()
  const disableDepositTab = currentDate > resolutionDate

  const [activeTab, setActiveTab] = useState(disableDepositTab ? Tabs.withdraw : Tabs.deposit)

  const initialCollateral = getInitialCollateral(context.networkId, marketMakerData.collateral, relay)
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  const [amountToFund, setAmountToFund] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToFundDisplay, setAmountToFundDisplay] = useState<string>('')
  const [amountToRemove, setAmountToRemove] = useState<Maybe<BigNumber>>(new BigNumber(0))
  const [amountToRemoveDisplay, setAmountToRemoveDisplay] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isNegativeAmountToFund, setIsNegativeAmountToFund] = useState<boolean>(false)
  const [isNegativeAmountToRemove, setIsNegativeAmountToRemove] = useState<boolean>(false)
  const [additionalShares, setAdditionalShares] = useState<number>(0)
  const [additionalSharesType, setAdditionalSharesType] = useState<Maybe<AdditionalSharesType>>()
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false)
  const [txState, setTxState] = useState<TransactionStep>(TransactionStep.idle)
  const [txHash, setTxHash] = useState('')

  useEffect(() => {
    setIsNegativeAmountToFund(bigNumberToNumber(amountToFund || Zero, collateral.decimals) < 0)
  }, [amountToFund, collateral.decimals])

  useEffect(() => {
    setIsNegativeAmountToRemove(bigNumberToNumber(amountToRemove || Zero, collateral.decimals) < 0)
  }, [amountToRemove, collateral.decimals])

  useEffect(() => {
    setCollateral(initialCollateral)
    setAmountToFund(null)
    setAmountToFundDisplay('')
    setAmountToRemove(null)
    setAmountToRemoveDisplay('')
    // eslint-disable-next-line
  }, [marketMakerData.collateral.address])

  const signer = useMemo(() => provider.getSigner(), [provider])
  const [allowanceFinished, setAllowanceFinished] = useState(false)
  const { allowance, unlock } = useCpkAllowance(signer, collateral.address)

  const { collateralBalance: maybeCollateralBalance, fetchCollateralBalance } = useCollateralBalance(
    collateral,
    context,
  )
  const collateralBalance = maybeCollateralBalance || Zero
  const { fetchFundingBalance, fundingBalance: maybeFundingBalance } = useFundingBalance(marketMakerAddress, context)
  const fundingBalance = maybeFundingBalance || Zero

  const walletBalance = bigNumberToString(collateralBalance, collateral.decimals, 5)
  const sharesBalance = bigNumberToString(fundingBalance, collateral.decimals)

  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(amountToFund || Zero))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())
  const showSetAllowance =
    collateral.address !== pseudoNativeAssetAddress &&
    !cpk?.isSafeApp &&
    (allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False)

  const poolTokens = calcPoolTokens(
    amountToFund || Zero,
    balances.map(b => b.holdings),
    totalPoolShares,
  )
  const disableWithdrawTab = isDust(fundingBalance, collateral.decimals)

  const sendAmountsAfterRemovingFunding = calcRemoveFundingSendAmounts(
    amountToRemove || Zero,
    balances.map(b => b.holdings),
    totalPoolShares,
  )

  const depositedTokens = sendAmountsAfterRemovingFunding.length
    ? sendAmountsAfterRemovingFunding.reduce((min: BigNumber, amount: BigNumber) => (amount.lt(min) ? amount : min))
    : new BigNumber(0)
  const depositedTokensTotal = depositedTokens.add(userEarnings)

  const feeFormatted = useMemo(() => `${bigNumberToString(fee.mul(Math.pow(10, 2)), STANDARD_DECIMALS)}%`, [fee])

  const totalUserShareAmounts = calcRemoveFundingSendAmounts(
    fundingBalance,
    balances.map(b => b.holdings),
    totalPoolShares,
  )

  const totalDepositedTokens = totalUserShareAmounts.length
    ? totalUserShareAmounts.reduce((min: BigNumber, amount: BigNumber) => (amount.lt(min) ? amount : min))
    : new BigNumber(0)

  const totalUserLiquidity = totalDepositedTokens.add(userEarnings)

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

  const addFunding = async () => {
    try {
      if (!cpk) {
        return
      }

      if (!account) {
        throw new Error('Please connect to your wallet to perform this action.')
      }

      if (!cpk?.isSafeApp && collateral.address !== pseudoNativeAssetAddress && hasEnoughAllowance !== Ternary.True) {
        throw new Error("This method shouldn't be called if 'hasEnoughAllowance' is unknown or false")
      }

      const fundsAmount = bigNumberToString(amountToFund || Zero, collateral.decimals)

      setMessage(`Depositing funds: ${fundsAmount} ${collateral.symbol}...`)

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)

      await cpk.addFunding({
        amount: amountToFund || Zero,
        collateral,
        marketMaker,
        setTxHash,
        setTxState,
      })

      await fetchGraphMarketUserTxData()
      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()

      setAmountToFund(null)
      setAmountToFundDisplay('')
      setMessage(`Successfully deposited ${fundsAmount} ${collateral.symbol}`)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to deposit funds.`)
      logger.error(`${message} - ${err.message}`)
    }
  }

  const removeFunding = async () => {
    try {
      if (!cpk) {
        return
      }

      setTxState(TransactionStep.waitingConfirmation)
      setIsTransactionModalOpen(true)
      const fundsAmount = bigNumberToString(depositedTokensTotal, collateral.decimals)

      setMessage(`Withdrawing funds: ${fundsAmount} ${collateral.symbol}...`)

      const conditionId = await marketMaker.getConditionId()

      await cpk.removeFunding({
        amountToMerge: depositedTokens,
        conditionId,
        conditionalTokens,
        earnings: userEarnings,
        marketMaker,
        outcomesCount: balances.length,
        setTxHash,
        setTxState,
        sharesToBurn: amountToRemove || Zero,
      })

      await fetchGraphMarketUserTxData()
      await fetchGraphMarketMakerData()
      await fetchFundingBalance()
      await fetchCollateralBalance()
      await fetchBalances()

      setAmountToRemove(null)
      setAmountToRemoveDisplay('')
      setMessage(`Successfully withdrew ${fundsAmount} ${collateral.symbol}`)
    } catch (err) {
      setTxState(TransactionStep.error)
      setMessage(`Error trying to withdraw funds.`)
      logger.error(`${message} - ${err.message}`)
    }
  }

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()

    setAllowanceFinished(true)
  }

  const collateralAmountError =
    maybeCollateralBalance === null
      ? null
      : maybeCollateralBalance.isZero() && amountToFund?.gt(maybeCollateralBalance)
      ? `Insufficient balance`
      : amountToFund?.gt(maybeCollateralBalance)
      ? `Value must be less than or equal to ${walletBalance} ${collateral.symbol}`
      : null

  const disableDepositButton =
    !amountToFund ||
    amountToFund?.isZero() ||
    (!cpk?.isSafeApp && collateral.address !== pseudoNativeAssetAddress && hasEnoughAllowance !== Ternary.True) ||
    collateralAmountError !== null ||
    currentDate > resolutionDate ||
    isNegativeAmountToFund

  const shouldDisplayMaxButton = collateral.address !== pseudoNativeAssetAddress

  useEffect(() => {
    // Use floor as rounding method
    Big.RM = 0

    const poolWeight =
      Number(outcomeTokenAmounts[0]) > Number(outcomeTokenAmounts[1])
        ? new Big(outcomeTokenAmounts[0])
        : new Big(outcomeTokenAmounts[1])

    const liquidityAmount = amountToFund?.gt(0)
      ? new Big(amountToFund.toString())
      : amountToRemove?.gt(0)
      ? new Big(amountToRemove?.toString())
      : new Big(0)

    const sendBackAmounts = outcomeTokenAmounts.map(amount => {
      const outcomeTokenAmount = new Big(amount)
      try {
        const remaining = liquidityAmount.mul(outcomeTokenAmount).div(poolWeight)
        return liquidityAmount.sub(remaining)
      } catch {
        return new Big(0)
      }
    })
    const extraShares = bigMax(sendBackAmounts).sub(bigMin(sendBackAmounts) || new Big(0))
    setAdditionalShares(Number(extraShares.toFixed(0)) / 10 ** collateral.decimals)

    if (activeTab === Tabs.deposit) {
      Number(outcomeTokenAmounts[0]) > Number(outcomeTokenAmounts[1])
        ? setAdditionalSharesType(AdditionalSharesType.long)
        : setAdditionalSharesType(AdditionalSharesType.short)
    } else {
      Number(outcomeTokenAmounts[0]) > Number(outcomeTokenAmounts[1])
        ? setAdditionalSharesType(AdditionalSharesType.short)
        : setAdditionalSharesType(AdditionalSharesType.long)
    }
  }, [collateral.decimals, outcomeTokenAmounts, amountToFund, amountToRemove, activeTab])

  const sharesAmountError =
    maybeFundingBalance === null
      ? null
      : maybeFundingBalance.isZero() && amountToRemove?.gt(maybeFundingBalance)
      ? `Insufficient balance`
      : amountToRemove?.gt(maybeFundingBalance)
      ? `Value must be less than or equal to ${sharesBalance} pool shares`
      : null

  const disableWithdrawButton =
    !amountToRemove ||
    amountToRemove?.isZero() ||
    amountToRemove?.gt(fundingBalance) ||
    sharesAmountError !== null ||
    isNegativeAmountToRemove

  return (
    <>
      <UserPoolData
        collateral={collateral}
        symbol={collateral.symbol}
        totalEarnings={totalEarnings}
        totalPoolShares={totalPoolShares}
        totalUserLiquidity={totalUserLiquidity}
        userEarnings={userEarnings}
      />
      <MarketScale
        additionalShares={additionalShares}
        additionalSharesType={additionalSharesType}
        borderTop={true}
        collateral={collateral}
        currentPrediction={outcomeTokenMarginalPrices ? outcomeTokenMarginalPrices[1] : null}
        liquidityAmount={amountToFund}
        lowerBound={scalarLow || new BigNumber(0)}
        startingPointTitle={'Current prediction'}
        unit={getUnit(question.title)}
        upperBound={scalarHigh || new BigNumber(0)}
      />
      <GridTransactionDetails>
        <div>
          <TabsGrid>
            <ButtonTab
              active={disableDepositTab ? false : activeTab === Tabs.deposit}
              disabled={disableDepositTab}
              onClick={() => setActiveTab(Tabs.deposit)}
            >
              Deposit
            </ButtonTab>
            <ButtonTab
              active={!disableWithdrawTab && activeTab === Tabs.withdraw}
              disabled={disableWithdrawTab}
              onClick={() => setActiveTab(Tabs.withdraw)}
            >
              Withdraw
            </ButtonTab>
          </TabsGrid>
          {activeTab === Tabs.deposit && (
            <>
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

              <TextfieldCustomPlaceholder
                formField={
                  <BigNumberInput
                    decimals={collateral.decimals}
                    name="amountToFund"
                    onChange={(e: BigNumberInputReturn) => {
                      setAmountToFund(e.value)
                      setAmountToFundDisplay('')
                    }}
                    style={{ width: 0 }}
                    value={amountToFund}
                    valueToDisplay={amountToFundDisplay}
                  />
                }
                onClickMaxButton={() => {
                  setAmountToFund(collateralBalance)
                  setAmountToFundDisplay(bigNumberToString(collateralBalance, collateral.decimals, 5, true))
                }}
                shouldDisplayMaxButton={shouldDisplayMaxButton}
                symbol={collateral.symbol}
              />

              {collateralAmountError && <GenericError>{collateralAmountError}</GenericError>}
            </>
          )}
          {activeTab === Tabs.withdraw && (
            <>
              <TokenBalance text="Pool Tokens" value={sharesBalance} />

              <TextfieldCustomPlaceholder
                formField={
                  <BigNumberInput
                    decimals={collateral.decimals}
                    name="amountToRemove"
                    onChange={(e: BigNumberInputReturn) => {
                      setAmountToRemove(e.value)
                      setAmountToRemoveDisplay('')
                    }}
                    style={{ width: 0 }}
                    value={amountToRemove}
                    valueToDisplay={amountToRemoveDisplay}
                  />
                }
                onClickMaxButton={() => {
                  setAmountToRemove(fundingBalance)
                  setAmountToRemoveDisplay(bigNumberToString(fundingBalance, collateral.decimals, 5, true))
                }}
                shouldDisplayMaxButton
                symbol="Shares"
              />

              {sharesAmountError && <GenericError>{sharesAmountError}</GenericError>}
            </>
          )}
        </div>
        <div>
          {activeTab === Tabs.deposit && (
            <TransactionDetailsCard>
              <TransactionDetailsRow
                emphasizeValue={fee.gt(0)}
                state={ValueStates.success}
                title="Earn Trading Fee"
                value={feeFormatted}
              />
              <TransactionDetailsLine />
              <TransactionDetailsRow
                emphasizeValue={poolTokens.gt(0)}
                state={(poolTokens.gt(0) && ValueStates.important) || ValueStates.normal}
                title="Pool Tokens"
                value={`${bigNumberToString(poolTokens, collateral.decimals)}`}
              />
            </TransactionDetailsCard>
          )}
          {activeTab === Tabs.withdraw && (
            <TransactionDetailsCard>
              <TransactionDetailsRow
                emphasizeValue={userEarnings.gt(0)}
                state={ValueStates.success}
                title="Earned"
                value={`${bigNumberToString(userEarnings, collateral.decimals)} ${collateral.symbol}`}
              />
              <TransactionDetailsRow
                state={ValueStates.normal}
                title="Deposited"
                value={`${bigNumberToString(depositedTokens, collateral.decimals)} ${collateral.symbol}`}
              />
              <TransactionDetailsLine />
              <TransactionDetailsRow
                emphasizeValue={depositedTokensTotal.gt(0)}
                state={(depositedTokensTotal.gt(0) && ValueStates.important) || ValueStates.normal}
                title="Total"
                value={`${bigNumberToString(depositedTokensTotal, collateral.decimals)} ${collateral.symbol}`}
              />
            </TransactionDetailsCard>
          )}
        </div>
      </GridTransactionDetails>
      {activeTab === Tabs.deposit && showSetAllowance && (
        <SetAllowanceStyled
          collateral={collateral}
          finished={allowanceFinished && RemoteData.is.success(allowance)}
          loading={RemoteData.is.asking(allowance)}
          onUnlock={unlockCollateral}
        />
      )}
      {activeTab === Tabs.deposit && showUpgrade && (
        <SetAllowanceStyled
          collateral={getNativeAsset(networkId, relay)}
          finished={upgradeFinished && RemoteData.is.success(proxyIsUpToDate)}
          loading={RemoteData.is.asking(proxyIsUpToDate)}
          onUnlock={upgradeProxy}
        />
      )}
      <WarningMessageStyled
        additionalDescription=""
        description="Providing liquidity is risky and could result in near total loss. It is important to withdraw liquidity before the event occurs and to be aware the market could move abruptly at any time."
        href={DOCUMENT_FAQ}
        hyperlinkDescription="More Info"
      />
      {isNegativeAmountToFund && (
        <WarningMessage
          additionalDescription=""
          danger={true}
          description="Your deposit amount should not be negative."
          href=""
          hyperlinkDescription=""
        />
      )}
      {isNegativeAmountToRemove && (
        <WarningMessage
          additionalDescription=""
          danger
          description="Your withdraw amount should not be negative."
          href=""
          hyperlinkDescription=""
        />
      )}
      <BottomButtonWrapper>
        <Button
          buttonType={ButtonType.secondaryLine}
          onClick={() => (history.length > 2 ? history.goBack() : history.replace('/liquidity'))}
        >
          Back
        </Button>
        {activeTab === Tabs.deposit && (
          <Button buttonType={ButtonType.primaryAlternative} disabled={disableDepositButton} onClick={addFunding}>
            Deposit
          </Button>
        )}
        {activeTab === Tabs.withdraw && (
          <Button buttonType={ButtonType.primaryAlternative} disabled={disableWithdrawButton} onClick={removeFunding}>
            Withdraw
          </Button>
        )}
      </BottomButtonWrapper>
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
