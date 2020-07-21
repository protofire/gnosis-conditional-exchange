import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { ChangeEvent, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import { DOCUMENT_FAQ } from '../../../../../../common/constants'
import {
  useCollateralBalance,
  useConnectedWeb3Context,
  useCpk,
  useCpkAllowance,
  useTokens,
} from '../../../../../../hooks'
import { BalanceState, fetchAccountBalance } from '../../../../../../store/reducer'
import { MarketCreationStatus } from '../../../../../../util/market_creation_status_data'
import { RemoteData } from '../../../../../../util/remote_data'
import {
  calcDistributionHint,
  calcInitialFundingSendAmounts,
  formatBigNumber,
  formatDate,
} from '../../../../../../util/tools'
import { Arbitrator, Ternary, Token } from '../../../../../../util/types'
import { Button } from '../../../../../button'
import { ButtonType } from '../../../../../button/button_styling_types'
import { BigNumberInput, SubsectionTitle, TextfieldCustomPlaceholder } from '../../../../../common'
import { BigNumberInputReturn } from '../../../../../common/form/big_number_input'
import { TitleValue } from '../../../../../common/text/title_value'
import { FullLoading } from '../../../../../loading'
import {
  ButtonContainerFullWidth,
  GenericError,
  LeftButton,
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
  TDFlexDiv,
} from '../../../../common/common_styled'
import { CreateCard } from '../../../../common/create_card'
import { CurrencySelector } from '../../../../common/currency_selector'
import { DisplayArbitrator } from '../../../../common/display_arbitrator'
import { GridTransactionDetails } from '../../../../common/grid_transaction_details'
import { SetAllowance } from '../../../../common/set_allowance'
import { TransactionDetailsCard } from '../../../../common/transaction_details_card'
import { TransactionDetailsLine } from '../../../../common/transaction_details_line'
import { TransactionDetailsRow, ValueStates } from '../../../../common/transaction_details_row'
import { WalletBalance } from '../../../../common/wallet_balance'
import { WarningMessage } from '../../../../common/warning_message'
import { Outcome } from '../outcomes'

const CreateCardTop = styled(CreateCard)`
  margin-bottom: 20px;
  min-height: 0;
`

const CreateCardBottom = styled(CreateCard)`
  min-height: 0;
`

const SubsectionTitleStyled = styled(SubsectionTitle)`
  margin-bottom: 20px;
`

const SubTitle = styled.h3`
  color: ${props => props.theme.colors.textColorDarker};
  font-size: 14px;
  font-weight: normal;
  margin: 0 0 6px;
`

const QuestionText = styled.p`
  color: ${props => props.theme.colors.textColor};
  font-size: 14px;
  font-weight: normal;
  margin: 0 0 20px;
`

const Grid = styled.div`
  display: grid;
  grid-column-gap: 32px;
  grid-row-gap: 20px;
  grid-template-columns: 1fr;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

const TitleValueVertical = styled(TitleValue)`
  flex-direction: column;
  justify-content: flex-start;

  > h2 {
    margin: 0 0 6px;
  }

  > p {
    text-align: left;
  }
`

const CurrenciesWrapper = styled.div`
  border-bottom: 1px solid ${props => props.theme.borders.borderColor};
  padding: 0 0 20px 0;
`

const GridTransactionDetailsStyled = styled(GridTransactionDetails)<{ noMarginTop: boolean }>`
  ${props => (props.noMarginTop ? 'margin-top: 0;' : '')};
`

const ButtonCreate = styled(Button)`
  font-weight: 500;
`

interface Props {
  back: () => void
  submit: () => void
  values: {
    collateral: Token
    question: string
    category: string
    resolution: Date | null
    arbitrator: Arbitrator
    spread: number
    funding: BigNumber
    outcomes: Outcome[]
  }
  marketCreationStatus: MarketCreationStatus
  handleCollateralChange: (collateral: Token) => void
  handleChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | BigNumberInputReturn) => any
}

const FundingAndFeeStep: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const cpk = useCpk()
  const balance = useSelector((state: BalanceState): Maybe<BigNumber> => state.balance && new BigNumber(state.balance))
  const dispatch = useDispatch()
  const { account, library: provider } = context
  const signer = useMemo(() => provider.getSigner(), [provider])

  const { back, handleChange, handleCollateralChange, marketCreationStatus, submit, values } = props
  const { arbitrator, category, collateral, funding, outcomes, question, resolution, spread } = values

  const [allowanceFinished, setAllowanceFinished] = useState(false)
  const { allowance, unlock } = useCpkAllowance(signer, collateral.address)

  const hasEnoughAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.gte(funding))
  const hasZeroAllowance = RemoteData.mapToTernary(allowance, allowance => allowance.isZero())

  React.useEffect(() => {
    dispatch(fetchAccountBalance(account, provider, collateral))
  }, [dispatch, account, provider, collateral])

  const maybeCollateralBalance = useCollateralBalance(collateral, context)
  const collateralBalance = maybeCollateralBalance || Zero
  const resolutionDate = resolution && formatDate(resolution)

  const collateralBalanceFormatted = formatBigNumber(collateralBalance, collateral.decimals, 5)

  const tokensAmount = useTokens(context).length

  const distributionHint = calcDistributionHint(outcomes.map(outcome => outcome.probability))
  const sharesAfterInitialFunding =
    distributionHint.length > 0
      ? calcInitialFundingSendAmounts(funding, distributionHint)
      : outcomes.map(() => new BigNumber(0))

  const amountError =
    maybeCollateralBalance === null
      ? null
      : maybeCollateralBalance.isZero() && funding.gt(maybeCollateralBalance)
      ? `Insufficient balance`
      : funding.gt(maybeCollateralBalance)
      ? `Value must be less than or equal to ${collateralBalanceFormatted} ${collateral.symbol}`
      : null

  const isCreateMarketbuttonDisabled =
    !MarketCreationStatus.is.ready(marketCreationStatus) ||
    MarketCreationStatus.is.error(marketCreationStatus) ||
    !balance ||
    funding.isZero() ||
    !account ||
    amountError !== null

  const showSetAllowance =
    allowanceFinished || hasZeroAllowance === Ternary.True || hasEnoughAllowance === Ternary.False

  const unlockCollateral = async () => {
    if (!cpk) {
      return
    }

    await unlock()
    setAllowanceFinished(true)
  }

  const onCollateralChange = (token: Token) => {
    handleCollateralChange(token)
    setAllowanceFinished(false)
  }

  return (
    <>
      <CreateCardTop>
        <SubsectionTitleStyled>Your Market</SubsectionTitleStyled>
        <SubTitle>Market Question</SubTitle>
        <QuestionText>{question}</QuestionText>
        <OutcomesTableWrapper>
          <OutcomesTable>
            <OutcomesTHead>
              <OutcomesTR>
                <OutcomesTH>Outcome</OutcomesTH>
                <OutcomesTH textAlign="right">Probability</OutcomesTH>
                <OutcomesTH textAlign="right">My Shares</OutcomesTH>
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
                    <OutcomesTD textAlign="right">{outcome.probability.toFixed(2)}%</OutcomesTD>
                    <OutcomesTD textAlign="right">
                      <TDFlexDiv textAlign="right">
                        {formatBigNumber(sharesAfterInitialFunding[index], collateral.decimals)}
                      </TDFlexDiv>
                    </OutcomesTD>
                  </OutcomesTR>
                )
              })}
            </OutcomesTBody>
          </OutcomesTable>
        </OutcomesTableWrapper>
        <Grid>
          <TitleValueVertical
            date={resolution instanceof Date ? resolution : undefined}
            title={'Resolution Date'}
            tooltip={true}
            value={resolutionDate}
          />
          <TitleValueVertical title={'Category'} value={category} />
          <TitleValueVertical title={'Arbitrator'} value={<DisplayArbitrator arbitrator={arbitrator} />} />
        </Grid>
      </CreateCardTop>
      <CreateCardBottom>
        <SubsectionTitleStyled>Fund Market</SubsectionTitleStyled>
        <WarningMessage
          additionalDescription={''}
          description={
            'Providing liquidity is risky and could result in near total loss. It is important to withdraw liquidity before the event occurs and to be aware the market could move abruptly at any time.'
          }
          href={DOCUMENT_FAQ}
          hyperlinkDescription={'More Info'}
        />
        {tokensAmount > 1 && (
          <CurrenciesWrapper>
            <SubTitle style={{ marginBottom: '14px' }}>Choose Currency</SubTitle>
            <CurrencySelector
              context={context}
              disabled={false}
              onSelect={onCollateralChange}
              selectedCurrency={collateral}
            />
          </CurrenciesWrapper>
        )}
        <GridTransactionDetailsStyled noMarginTop={false}>
          <div>
            <WalletBalance symbol={collateral.symbol} value={collateralBalanceFormatted} />
            <TextfieldCustomPlaceholder
              formField={
                <BigNumberInput decimals={collateral.decimals} name="funding" onChange={handleChange} value={funding} />
              }
              symbol={collateral.symbol}
            />
            {amountError && <GenericError>{amountError}</GenericError>}
          </div>
          <div>
            <TransactionDetailsCard>
              <TransactionDetailsRow state={ValueStates.important} title={'Earn Trading Fee'} value={`${spread}%`} />
              <TransactionDetailsLine />
              <TransactionDetailsRow title={'Pool Tokens'} value={formatBigNumber(funding, collateral.decimals)} />
            </TransactionDetailsCard>
          </div>
        </GridTransactionDetailsStyled>
        {showSetAllowance && (
          <SetAllowance
            collateral={collateral}
            finished={allowanceFinished && RemoteData.is.success(allowance)}
            loading={RemoteData.is.asking(allowance)}
            onUnlock={unlockCollateral}
          />
        )}
        <ButtonContainerFullWidth>
          <LeftButton
            buttonType={ButtonType.secondaryLine}
            disabled={
              !MarketCreationStatus.is.ready(marketCreationStatus) &&
              !MarketCreationStatus.is.error(marketCreationStatus)
            }
            onClick={back}
          >
            Back
          </LeftButton>
          {!account && (
            <Button buttonType={ButtonType.primary} onClick={submit}>
              Connect Wallet
            </Button>
          )}
          <ButtonCreate buttonType={ButtonType.primary} disabled={isCreateMarketbuttonDisabled} onClick={submit}>
            Create Market
          </ButtonCreate>
        </ButtonContainerFullWidth>
      </CreateCardBottom>
      {!MarketCreationStatus.is.ready(marketCreationStatus) && !MarketCreationStatus.is.error(marketCreationStatus) ? (
        <FullLoading message={`${marketCreationStatus._type}...`} />
      ) : null}
    </>
  )
}

export { FundingAndFeeStep }
