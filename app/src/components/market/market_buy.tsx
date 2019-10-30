import React, { useMemo, useState, useEffect } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers/utils'
import { ethers } from 'ethers'
import { withRouter, RouteComponentProps } from 'react-router-dom'

import { BalanceItem, OutcomeSlot, Status, OutcomeTableValue, Token } from '../../util/types'
import { Button, BigNumberInput, OutcomeTable } from '../common'
import { ConditionalTokenService, ERC20Service, MarketMakerService } from '../../services'
import { SubsectionTitle } from '../common/subsection_title'
import { Table, TD, TR } from '../common/table'
import { ViewCard } from '../common/view_card'
import { computeBalanceAfterTrade, formatDate } from '../../util/tools'
import { getLogger } from '../../util/logger'
import { useConnectedWeb3Context } from '../../hooks/connectedWeb3'
import { useAsyncDerivedValue } from '../../hooks/useAsyncDerivedValue'
import { Well } from '../common/well'
import { FullLoading } from '../common/full_loading'
import { ButtonContainer } from '../common/button_container'
import { ButtonLink } from '../common/button_link'
import { FormRow } from '../common/form_row'
import { FormLabel } from '../common/form_label'
import { TextfieldCustomPlaceholder } from '../common/textfield_custom_placeholder'
import { BigNumberInputReturn } from '../common/big_number_input'
import { SectionTitle } from '../common/section_title'

const ButtonLinkStyled = styled(ButtonLink)`
  margin-right: auto;
`

const TableStyled = styled(Table)`
  margin-bottom: 30px;
`

const AmountWrapper = styled(FormRow)`
  margin-bottom: 30px;
  width: 100%;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    width: 50%;
  }
`

const FormLabelStyled = styled(FormLabel)`
  margin-bottom: 10px;
`

const logger = getLogger('Market::Buy')

interface Props extends RouteComponentProps<any> {
  marketMakerAddress: string
  marketMakerFunding: BigNumber
  balance: BalanceItem[]
  collateral: Token
  conditionalTokens: ConditionalTokenService
  question: string
  resolution: Maybe<Date>
}

const MarketBuyWrapper = (props: Props) => {
  const context = useConnectedWeb3Context()

  const { marketMakerAddress, balance, collateral, conditionalTokens, question, resolution } = props

  const [status, setStatus] = useState<Status>(Status.Ready)
  const [outcome, setOutcome] = useState<OutcomeSlot>(OutcomeSlot.Yes)
  const [cost, setCost] = useState<BigNumber>(new BigNumber(0))
  const [amount, setAmount] = useState<BigNumber>(new BigNumber(0))
  const [message, setMessage] = useState<string>('')
  const [priceAfterTradeForYes, setPriceAfterTradeForYes] = useState<number>(0)
  const [priceAfterTradeForNo, setPriceAfterTradeForNo] = useState<number>(0)

  const holdingsYes = balance[0].holdings
  const holdingsNo = balance[1].holdings

  const marketMaker = new MarketMakerService(marketMakerAddress, conditionalTokens, context.library)

  // get the amount of shares that will be traded
  const calcBuyAmount = useMemo(
    () => (amount: BigNumber) => {
      return marketMaker.calcBuyAmount(amount, outcome)
    },
    [outcome, marketMaker],
  )
  const tradedShares = useAsyncDerivedValue(amount, new BigNumber(0), calcBuyAmount)

  useEffect(() => {
    const getPriceAfterTrade = async () => {
      const balanceAfterTrade = computeBalanceAfterTrade(holdingsYes, holdingsNo, amount)
      const { actualPriceForYes, actualPriceForNo } = await marketMaker.getActualPrice(
        balanceAfterTrade,
      )
      setPriceAfterTradeForYes(actualPriceForYes)
      setPriceAfterTradeForNo(actualPriceForNo)
    }
    getPriceAfterTrade()
  }, [marketMaker, amount, holdingsYes, holdingsNo])

  useEffect(() => {
    const valueNumber = +ethers.utils.formatUnits(amount, collateral.decimals)

    const weiPerUnit = ethers.utils.bigNumberify(10).pow(collateral.decimals)
    const costWithFee = ethers.utils
      .bigNumberify('' + Math.round(valueNumber * 1.01 * 10000)) // cast to string to avoid overflows
      .mul(weiPerUnit)
      .div(10000)
    setCost(costWithFee)
  }, [outcome, amount, balance, collateral])

  const finish = async () => {
    try {
      setStatus(Status.Loading)
      setMessage(`Buying ${ethers.utils.formatUnits(tradedShares, collateral.decimals)} shares ...`)

      const provider = context.library
      const user = await provider.getSigner().getAddress()

      const collateralAddress = await marketMaker.getCollateralToken()

      const collateralService = new ERC20Service(collateralAddress)

      const hasEnoughAlowance = await collateralService.hasEnoughAllowance(
        provider,
        user,
        marketMakerAddress,
        cost,
      )

      if (!hasEnoughAlowance) {
        // add 10% to the approved amount because there can be precision errors
        // this can be improved if, instead of adding the 1% fee manually in the front, we use the `calcMarketFee`
        // contract method and add it to the result of `calcNetCost` result
        const costWithErrorMargin = cost.mul(11000).div(10000)
        await collateralService.approve(provider, marketMakerAddress, costWithErrorMargin)
      }

      await marketMaker.buy(amount, outcome)

      setStatus(Status.Ready)
    } catch (err) {
      setStatus(Status.Error)
      logger.log(`Error trying to buy: ${err.message}`)
    }
  }

  const disabled = (status !== Status.Ready && status !== Status.Error) || cost.isZero()

  return (
    <>
      <SectionTitle title={question} subTitle={resolution ? formatDate(resolution) : ''} />
      <ViewCard>
        <SubsectionTitle>Choose the shares you want to buy</SubsectionTitle>
        <OutcomeTable
          balance={balance}
          collateral={collateral}
          pricesAfterTrade={[priceAfterTradeForNo, priceAfterTradeForYes]}
          outcomeSelected={outcome}
          outcomeHandleChange={(value: OutcomeSlot) => setOutcome(value)}
          disabledColumns={[OutcomeTableValue.Shares, OutcomeTableValue.Payout]}
        />
        <AmountWrapper
          formField={
            <TextfieldCustomPlaceholder
              formField={
                <BigNumberInput
                  name="amount"
                  value={amount}
                  onChange={(e: BigNumberInputReturn) => setAmount(e.value)}
                  decimals={collateral.decimals}
                />
              }
              placeholderText={collateral.symbol}
            />
          }
          note={[
            'You will be charged an extra 1% trade fee of ',
            <strong key="1">
              {cost.isZero()
                ? '0'
                : ethers.utils.formatUnits(cost.sub(amount), collateral.decimals)}
            </strong>,
          ]}
          title={'Amount'}
          tooltipText={'Transaction fees.'}
        />
        <FormLabelStyled>Totals</FormLabelStyled>
        <TableStyled>
          <TR>
            <TD>You spend</TD>
            <TD textAlign="right">
              {ethers.utils.formatUnits(cost, collateral.decimals)}{' '}
              <strong>{collateral.symbol}</strong>
            </TD>
          </TR>
          <TR>
            <TD>&quot;{outcome}&quot; shares you get</TD>
            <TD textAlign="right">
              {ethers.utils.formatUnits(tradedShares, collateral.decimals)} <strong>shares</strong>
            </TD>
          </TR>
        </TableStyled>
        <Well>
          <strong>1 shares</strong> can be redeemed for <strong>1 {collateral.symbol}</strong> in
          case it represents the final outcome.
        </Well>
        <ButtonContainer>
          <ButtonLinkStyled onClick={() => props.history.push(`/${marketMakerAddress}`)}>
            ‹ Back
          </ButtonLinkStyled>
          <Button disabled={disabled} onClick={() => finish()}>
            Finish
          </Button>
        </ButtonContainer>
      </ViewCard>
      {status === Status.Loading ? <FullLoading message={message} /> : null}
    </>
  )
}

export const MarketBuy = withRouter(MarketBuyWrapper)
