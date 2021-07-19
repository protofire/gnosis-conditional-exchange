import { ethers } from 'ethers'
import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import {
  DEFAULT_TOKEN_ADDRESS,
  DEFAULT_TOKEN_ADDRESS_RINKEBY,
  DOCUMENT_FAQ,
  MAX_MARKET_FEE,
} from '../../../../../../common/constants'
import { useCollateralBalance, useConnectedWeb3Context, useCpkAllowance, useCpkProxy } from '../../../../../../hooks'
import { useGraphMarketsFromQuestion } from '../../../../../../hooks/useGraphMarketsFromQuestion'
import { BalanceState, fetchAccountBalance } from '../../../../../../store/reducer'
import { MarketCreationStatus } from '../../../../../../util/market_creation_status_data'
import { getNativeAsset, pseudoNativeAssetAddress } from '../../../../../../util/networks'
import { RemoteData } from '../../../../../../util/remote_data'
import { bigNumberToNumber, bigNumberToString, formatDate } from '../../../../../../util/tools'
import { Arbitrator, Ternary, Token } from '../../../../../../util/types'
import { Button, ButtonContainer } from '../../../../../button'
import { ButtonType } from '../../../../../button/button_styling_types'
import { BigNumberInput, SubsectionTitle, TextfieldCustomPlaceholder } from '../../../../../common'
import { BigNumberInputReturn } from '../../../../../common/form/big_number_input'
import { TitleValue } from '../../../../../common/text/title_value'
import {
  CurrenciesWrapper,
  GenericError,
  MarginsButton,
  OutcomeItemLittleBallOfJoyAndDifferentColors,
  OutcomeItemText,
  OutcomeItemTextWrapper,
  OutcomesTBody,
  OutcomesTD,
  OutcomesTH,
  OutcomesTHead,
  OutcomesTR,
  OutcomesTable,
  OutcomesTableWrapper,
} from '../../../../common/common_styled'
import { CreateCard } from '../../../../common/create_card'
import { CurrencySelector } from '../../../../common/currency_selector'
import { DisplayArbitrator } from '../../../../common/display_arbitrator'
import { GridTransactionDetails } from '../../../../common/grid_transaction_details'
import { MarketScale } from '../../../../common/market_scale'
import { SetAllowance } from '../../../../common/set_allowance'
import { TradingFeeSelector } from '../../../../common/trading_fee_selector'
import { TransactionDetailsCard } from '../../../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../../../common/transaction_details_row'
import { VerifiedRow } from '../../../../common/verified_row'
import { WarningMessage } from '../../../../common/warning_message'
import { Outcome } from '../outcomes'

const CreateCardTop = styled(CreateCard)`
  margin-bottom: 20px;
  min-height: 0;
  padding: 24px;
`

const CreateCardBottom = styled(CreateCard)`
  min-height: 0;
`

const SubsectionTitleStyled = styled(SubsectionTitle)`
  margin-bottom: 24px;
`

const LeftButton = styled(Button as any)`
  margin-right: auto;
`

const SubTitle = styled.h3`
  color: ${props => props.theme.colors.textColor};
  font-size: 14px;
  font-weight: normal;
  margin: 0 0 8px;
`

const QuestionText = styled.p`
  color: ${props => props.theme.colors.textColorDarker};
  font-size: 14px;
  font-weight: normal;
  margin: 0 0 24px;
`

const TitleValueVertical = styled(TitleValue)`
  flex-direction: column;
  justify-content: flex-start;
  text-transform: capitalize;

  > h2 {
    margin: 0 0 6px;
  }

  > p {
    text-align: left;
  }
`

const GridTransactionDetailsWrapper = styled(GridTransactionDetails)<{ noMarginTop: boolean }>`
  ${props => (props.noMarginTop ? 'margin-top: 0;' : '')};
`

const CreateCardBottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CustomFeeToggle = styled.p`
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  margin-top: 0;

  &:hover {
    text-decoration: underline;
  }
`

const CustomFeeWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0 0 0;
`

const CustomFeeLabel = styled.p`
  width: 50%;
  margin: 0;
  color: ${props => props.theme.colors.textColorDark};
  font-size: 14px;
  line-height: 16px;
`

const StyledTradingFeeSelector = styled(TradingFeeSelector)`
  width: 50%;
  .dropdownItems {
    min-width: auto;
  }
`

const FlexRowWrapper = styled.div`
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  & > * + * {
    margin-left: 48px;
  }
`

const StyledButtonContainerFullWidth = styled(ButtonContainer)`
  ${MarginsButton};
  padding-top: 24px;
  margin-bottom: -1px;
`

interface Props {
  back: (state: string) => void
  submit: (isScalar: boolean) => void
  values: {
    collateral: Token
    question: string
    category: string
    resolution: Date | null
    arbitrator: Arbitrator
    spread: number
    funding: BigNumber
    outcomes: Outcome[]
    loadedQuestionId: Maybe<string>
    verifyLabel?: string
    lowerBound?: Maybe<BigNumber>
    upperBound?: Maybe<BigNumber>
    startingPoint?: Maybe<BigNumber>
    unit?: string
  }
  marketCreationStatus: MarketCreationStatus
  handleCollateralChange: (collateral: Token, amount: BigNumber) => void
  handleTradingFeeChange: (fee: string) => void
  handleChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | BigNumberInputReturn) => any
  resetTradingFee: () => void
  state: string
}

const FundingAndFeeStep: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const balance = useSelector((state: BalanceState): Maybe<BigNumber> => state.balance && new BigNumber(state.balance))
  const dispatch = useDispatch()
  const { account, cpk, library: provider, networkId, relay } = context
  const signer = useMemo(() => provider.getSigner(), [provider])
  const {
    back,
    handleChange,
    handleCollateralChange,
    handleTradingFeeChange,
    marketCreationStatus,
    resetTradingFee,
    state,
    submit,
    values,
  } = props

  const {
    arbitrator,
    category,
    collateral,
    funding,
    loadedQuestionId,
    lowerBound,
    outcomes,
    question,
    resolution,
    spread,
    startingPoint,
    unit,
    upperBound,
  } = values

  const { markets } = useGraphMarketsFromQuestion(loadedQuestionId || '')

  const [currentToken, setCurrentToken] = useState({ tokenExists: false, symbol: '', marketAddress: '' })

  useEffect(() => {
    const selectedToken = markets.find(
      ({ collateralToken }) =>
        collateralToken === DEFAULT_TOKEN_ADDRESS_RINKEBY || collateralToken === DEFAULT_TOKEN_ADDRESS,
    )
    setCurrentToken({
      tokenExists: selectedToken ? true : false,
      symbol: 'DAI',
      marketAddress: selectedToken ? selectedToken.id : '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [allowanceFinished, setAllowanceFinished] = useState(false)
  const { allowance, unlock } = useCpkAllowance(signer, collateral.address)

  const [amount, setAmount] = useState<BigNumber>(funding)
  const [formattedAmount, setFormattedAmount] = useState<string>(Zero.toString())
  const [amountToDisplay, setAmountToDisplay] = useState<string>('')
  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(funding))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())

  const [upgradeFinished, setUpgradeFinished] = useState(false)
  const { proxyIsUpToDate, updateProxy } = useCpkProxy()
  const isUpdated = RemoteData.hasData(proxyIsUpToDate) ? proxyIsUpToDate.data : true

  useEffect(() => {
    dispatch(fetchAccountBalance(account, provider, collateral))
  }, [dispatch, account, provider, collateral])

  const [collateralBalance, setCollateralBalance] = useState<BigNumber>(Zero)
  const [collateralBalanceFormatted, setCollateralBalanceFormatted] = useState<string>(
    bigNumberToString(collateralBalance, collateral.decimals, 5),
  )
  const { collateralBalance: maybeCollateralBalance } = useCollateralBalance(collateral, context)

  const [isNegativeDepositAmount, setIsNegativeDepositAmount] = useState<boolean>(false)

  useEffect(() => {
    setCollateralBalance(maybeCollateralBalance || Zero)
    setCollateralBalanceFormatted(bigNumberToString(maybeCollateralBalance || Zero, collateral.decimals, 5))
    // eslint-disable-next-line
  }, [maybeCollateralBalance])

  useEffect(() => {
    setIsNegativeDepositAmount(bigNumberToNumber(funding, collateral.decimals) < 0)
  }, [funding, collateral.decimals])

  const resolutionDate = resolution && formatDate(resolution, false)

  const [customFee, setCustomFee] = useState(false)
  const [exceedsMaxFee, setExceedsMaxFee] = useState<boolean>(false)

  const amountError =
    maybeCollateralBalance === null
      ? null
      : !maybeCollateralBalance.eq(collateralBalance)
      ? null
      : maybeCollateralBalance.isZero() && funding.gt(maybeCollateralBalance)
      ? `Insufficient balance`
      : funding.gt(maybeCollateralBalance)
      ? `Value must be less than or equal to ${formattedAmount} ${collateral.symbol}`
      : null

  const isCreateMarketbuttonDisabled =
    MarketCreationStatus.is.creatingAMarket(marketCreationStatus) ||
    MarketCreationStatus.is.done(marketCreationStatus) ||
    currentToken.tokenExists ||
    !balance ||
    funding.isZero() ||
    !account ||
    amountError !== null ||
    exceedsMaxFee ||
    isNegativeDepositAmount ||
    (!isUpdated && collateral.address === pseudoNativeAssetAddress)

  const showSetAllowance =
    collateral.address !== pseudoNativeAssetAddress &&
    !cpk?.isSafeApp &&
    (allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False)

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

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()
    setAllowanceFinished(true)
  }

  const onCollateralChange = (token: Token | null) => {
    if (!token || !token.balance) return
    const tokenAddressFormatted = token.address.toLowerCase()
    const selectedToken = markets.find(({ collateralToken }) => collateralToken === tokenAddressFormatted)
    setCurrentToken({
      tokenExists: selectedToken ? true : false,
      symbol: token.symbol,
      marketAddress: selectedToken ? selectedToken.id : '',
    })

    // optimistically update collateral balance
    const newCollateralBalance = new BigNumber(token.balance)
    setCollateralBalance(newCollateralBalance)
    setCollateralBalanceFormatted(bigNumberToString(newCollateralBalance, token.decimals, 5))

    const newAmount = ethers.utils.parseUnits(Number(formattedAmount).toFixed(token.decimals), token.decimals)

    setAmount(newAmount)
    handleCollateralChange(token, newAmount)
    setAllowanceFinished(false)
  }

  const toggleCustomFee = () => {
    if (customFee) {
      resetTradingFee()
      setCustomFee(false)
    } else {
      setCustomFee(true)
    }
  }

  useEffect(() => {
    setExceedsMaxFee(spread > MAX_MARKET_FEE)
  }, [spread])

  const handleAmountChange = (event: BigNumberInputReturn) => {
    setAmount(event.value)
    setFormattedAmount(event.formattedValue || '')
    setAmountToDisplay('')
    handleChange(event)
  }

  const onClickMaxButton = async () => {
    setAmount(collateralBalance)
    handleChange({
      name: 'funding',
      value: collateralBalance,
    })
    const formatted = bigNumberToString(collateralBalance, collateral.decimals, 5, true)
    setAmountToDisplay(formatted)
    setFormattedAmount(formatted)
  }

  return (
    <>
      <CreateCardTop>
        <SubsectionTitleStyled>
          Your {state.charAt(0).toUpperCase() + state.slice(1).toLowerCase()} Market
        </SubsectionTitleStyled>
        <SubTitle>Question</SubTitle>
        <QuestionText>{question}</QuestionText>
        {state === 'SCALAR' && lowerBound && upperBound && startingPoint && unit ? (
          <MarketScale
            lowerBound={lowerBound}
            startingPoint={startingPoint}
            startingPointTitle={'Starting Point'}
            unit={unit}
            upperBound={upperBound}
          />
        ) : (
          <OutcomesTableWrapper borderBottom>
            <OutcomesTable>
              <OutcomesTHead>
                <OutcomesTR>
                  <OutcomesTH style={{ width: '60%' }}>Outcome</OutcomesTH>
                  <OutcomesTH>Probability</OutcomesTH>
                </OutcomesTR>
              </OutcomesTHead>
              <OutcomesTBody>
                {outcomes.map((outcome, index) => {
                  return (
                    <OutcomesTR key={index}>
                      <OutcomesTD>
                        <OutcomeItemTextWrapper>
                          <OutcomeItemLittleBallOfJoyAndDifferentColors outcomeIndex={index} />
                          <OutcomeItemText>{outcome.name}</OutcomeItemText>
                        </OutcomeItemTextWrapper>
                      </OutcomesTD>
                      <OutcomesTD>{outcome.probability.toFixed(2)}%</OutcomesTD>
                    </OutcomesTR>
                  )
                })}
              </OutcomesTBody>
            </OutcomesTable>
          </OutcomesTableWrapper>
        )}
        <FlexRowWrapper>
          <TitleValueVertical
            date={resolution instanceof Date ? resolution : undefined}
            invertedColors={true}
            title={'Closing Date (UTC)'}
            tooltip={true}
            value={resolutionDate}
          />
          <TitleValueVertical invertedColors={true} title={'Category'} value={category} />
          <TitleValueVertical
            invertedColors={true}
            title={'Arbitrator'}
            value={<DisplayArbitrator arbitrator={arbitrator} />}
          />
          {!!loadedQuestionId && (
            <TitleValueVertical
              invertedColors={true}
              title={'Verified by'}
              value={<VerifiedRow label={values.verifyLabel} />}
            />
          )}
        </FlexRowWrapper>
      </CreateCardTop>
      <CreateCardBottom>
        <CreateCardBottomRow>
          <SubsectionTitleStyled>Fund Market</SubsectionTitleStyled>
          <CustomFeeToggle onClick={toggleCustomFee}>
            {customFee ? 'use default trading fee' : 'set custom trading fee'}
          </CustomFeeToggle>
        </CreateCardBottomRow>

        <GridTransactionDetailsWrapper noMarginTop={true}>
          <div>
            <CurrenciesWrapper>
              <CurrencySelector
                addBalances
                addNativeAsset
                balance={collateralBalanceFormatted}
                context={context}
                currency={collateral.address}
                onSelect={onCollateralChange}
              />
            </CurrenciesWrapper>
            <TextfieldCustomPlaceholder
              formField={
                <BigNumberInput
                  decimals={collateral.decimals}
                  name="funding"
                  onChange={handleAmountChange}
                  style={{ width: 0 }}
                  value={amount}
                  valueToDisplay={amountToDisplay}
                />
              }
              onClickMaxButton={onClickMaxButton}
              shouldDisplayMaxButton={shouldDisplayMaxButton}
              symbol={collateral.symbol}
            />
            {customFee && (
              <CustomFeeWrapper>
                <CustomFeeLabel>Trading Fee</CustomFeeLabel>
                <StyledTradingFeeSelector
                  disabled={false}
                  fee={isNaN(spread) ? '0.00%' : `${spread.toFixed(2)}%`}
                  onSelect={handleTradingFeeChange}
                />
              </CustomFeeWrapper>
            )}
            {amountError && <GenericError>{amountError}</GenericError>}
          </div>
          <div>
            <TransactionDetailsCard>
              <TransactionDetailsRow
                state={ValueStates.important}
                title={'Earn Trading Fee'}
                value={`${isNaN(spread) ? 0 : spread}%`}
              />
              <TransactionDetailsLine />
              <TransactionDetailsRow title={'Pool Tokens'} value={bigNumberToString(funding, collateral.decimals)} />
            </TransactionDetailsCard>
          </div>
        </GridTransactionDetailsWrapper>

        {exceedsMaxFee && (
          <WarningMessage
            additionalDescription={''}
            danger={true}
            description={`Your custom trading fee exceeds the maximum amount of ${MAX_MARKET_FEE}%`}
            href={''}
            hyperlinkDescription={''}
          />
        )}
        {isNegativeDepositAmount && (
          <WarningMessage
            additionalDescription={''}
            danger={true}
            description={`Your deposit amount should not be negative.`}
            href={''}
            hyperlinkDescription={''}
          />
        )}
        {showSetAllowance && (
          <SetAllowance
            collateral={collateral}
            finished={allowanceFinished && RemoteData.is.success(allowance)}
            loading={RemoteData.is.asking(allowance)}
            marginBottom
            onUnlock={unlockCollateral}
            style={{ marginBottom: 20 }}
          />
        )}
        {showUpgrade && (
          <SetAllowance
            collateral={getNativeAsset(networkId, relay)}
            finished={upgradeFinished && RemoteData.is.success(proxyIsUpToDate)}
            loading={RemoteData.is.asking(proxyIsUpToDate)}
            onUnlock={upgradeProxy}
            style={{ marginBottom: 20 }}
          />
        )}
        <WarningMessage
          additionalDescription={''}
          description={
            currentToken.tokenExists
              ? `An identical market with ${currentToken.symbol} as a currency exists already. Please use a different currency or  provide liquidity for the`
              : 'Providing liquidity is risky and could result in near total loss. It is important to withdraw liquidity before the event occurs and to be aware the market could move abruptly at any time.'
          }
          href={currentToken.tokenExists ? `/#/${currentToken.marketAddress}` : DOCUMENT_FAQ}
          hyperlinkDescription={currentToken.tokenExists ? 'existing market.' : 'More Info'}
        />
        <StyledButtonContainerFullWidth borderTop>
          <LeftButton
            buttonType={ButtonType.secondaryLine}
            disabled={
              !MarketCreationStatus.is.ready(marketCreationStatus) &&
              !MarketCreationStatus.is.error(marketCreationStatus)
            }
            onClick={() => back(state)}
          >
            Back
          </LeftButton>
          {!account && (
            <Button buttonType={ButtonType.primary} onClick={() => submit(state === 'SCALAR')}>
              Connect Wallet
            </Button>
          )}
          <Button
            buttonType={ButtonType.secondaryLine}
            disabled={isCreateMarketbuttonDisabled}
            onClick={() => submit(state === 'SCALAR')}
          >
            Create Market
          </Button>
        </StyledButtonContainerFullWidth>
      </CreateCardBottom>
    </>
  )
}

export { FundingAndFeeStep }
