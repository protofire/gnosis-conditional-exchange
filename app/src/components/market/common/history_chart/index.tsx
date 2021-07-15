import { BigNumber } from 'ethers/utils'
import React from 'react'
import { useHistory } from 'react-router'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styled from 'styled-components'

import { getOutcomeColor } from '../../../../theme/utils'
import { calcPrediction } from '../../../../util/tools'
import { Button } from '../../../button/button'
import { ButtonType } from '../../../button/button_styling_types'
import { OutcomeItemLittleBallOfJoyAndDifferentColors } from '../common_styled'
import { CustomInlineLoading } from '../history_table'

const ResponsiveWrapper = styled.div`
  margin: 21px 24.5px;
  border: 1px solid ${props => props.theme.borders.borderDisabled};
  padding-bottom: 16px;
  border-radius: 6px;
`

const ChartTooltip = styled.div`
  background: #fff;
  border-radius: 2px;
  border: 1px solid ${props => props.theme.borders.borderDisabled};
  box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.12);
  min-width: 160px;
  padding: 17px;
`

const TooltipTitle = styled.h4`
  color: ${props => props.theme.text1};
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  margin: 0 0 10px;
  text-align: left;
`
const Legends = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`
const ButtonWrapper = styled.div`
  border-top: ${props => props.theme.borders.borderLineDisabled};
  padding-top: 20px;
  padding-left: 24px;
`

const Legend = styled.li`
  align-items: center;
  color: ${props => props.theme.text4};
  display: flex;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  padding: 0;

  strong {
    color: ${props => props.theme.text3};
    font-weight: 500;
    margin-right: 6px;
  }
`
const NoData = styled.div`
  align-items: center;
  color: ${props => props.theme.text3};
  display: flex;
  font-size: 15px;
  font-weight: 400;
  height: 340px;
  justify-content: center;
  letter-spacing: 0.4px;
  line-height: 1.3;
  padding-left: ${props => props.theme.cards.paddingHorizontal};
  padding-right: ${props => props.theme.cards.paddingHorizontal};
`

const AnEvenSmallerLittleBall = styled(OutcomeItemLittleBallOfJoyAndDifferentColors as any)`
  height: 8px;
  margin-right: 12px;
  width: 8px;
`

const AxisWrapper = styled.div`
  display: inline;
  stroke: ${props => props.theme.primary4};
  fill: ${props => props.theme.text4};
`

const toPercent = (decimal: number, fixed = 0) => {
  return `${(decimal * 100).toFixed(fixed)}%`
}
const renderTooltipContent = (o: any) => {
  const { label, payload } = o

  return (
    <ChartTooltip>
      <TooltipTitle>{label}</TooltipTitle>
      <Legends>
        {payload.reverse().map((entry: any, index: number) => (
          <Legend key={`item-${index}`}>
            <AnEvenSmallerLittleBall outcomeIndex={index} />
            <strong>{`${toPercent(entry.value)}`}</strong>
            {`- ${entry.name}`}
          </Legend>
        ))}
      </Legends>
    </ChartTooltip>
  )
}
type Props = {
  data: { date: string }[] | null
  outcomes: string[]
  scalarHigh?: Maybe<BigNumber>
  scalarLow?: Maybe<BigNumber>
  unit: string
  isScalar?: Maybe<boolean>
  sharesDataLoader: boolean
  status: any
  notEnoughData: boolean
}

export const HistoryChart: React.FC<Props> = ({
  data,
  isScalar,
  notEnoughData,
  outcomes,
  scalarHigh,
  scalarLow,
  sharesDataLoader,
  status,
  unit,
}) => {
  const history = useHistory()

  const toScaleValue = (decimal: number, fixed = 0) => {
    return `${calcPrediction(decimal.toString(), scalarLow || new BigNumber(0), scalarHigh || new BigNumber(0)).toFixed(
      fixed,
    )} ${unit}`
  }

  const renderScalarTooltipContent = (o: any) => {
    const { label, payload } = o
    const prediction = calcPrediction(
      payload[0]?.value,
      scalarLow || new BigNumber(0),
      scalarHigh || new BigNumber(0),
    ).toFixed(2)
    return (
      <ChartTooltip>
        <TooltipTitle>{label}</TooltipTitle>
        <Legends>
          <Legend key={`item-0`}>
            <AnEvenSmallerLittleBall outcomeIndex={0} />
            <strong>{`${prediction}`}</strong>
            {`${unit}`}
          </Legend>
        </Legends>
      </ChartTooltip>
    )
  }

  if (!data || status === 'Loading' || sharesDataLoader) {
    return <CustomInlineLoading message="Loading Trade History" />
  }
  if (notEnoughData) {
    return <NoData>There is not enough historical data for this market</NoData>
  }
  return (
    <>
      <ResponsiveWrapper>
        <ResponsiveContainer height={300} width="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} stackOffset="expand">
            <AxisWrapper>
              <XAxis
                dataKey="date"
                stroke={'inherit'}
                tick={{ fill: 'inherit', fontFamily: 'Roboto' }}
                tickMargin={11}
              />
              <YAxis
                orientation="right"
                stroke={'inherit'}
                tick={{ fill: 'inherit', fontFamily: 'Roboto' }}
                tickFormatter={isScalar ? toScaleValue : toPercent}
                tickMargin={10}
              />
            </AxisWrapper>
            <Tooltip content={isScalar ? renderScalarTooltipContent : renderTooltipContent} />

            {outcomes
              .map((outcomeName, index) => {
                const color = getOutcomeColor(index)

                return (
                  <Area
                    dataKey={outcomeName}
                    fill={color.medium}
                    key={`${index}-${outcomeName}`}
                    stackId="1"
                    stroke={color.darker}
                    type="monotone"
                  />
                )
              })
              .reverse()}
          </AreaChart>
        </ResponsiveContainer>
      </ResponsiveWrapper>
      <ButtonWrapper>
        <Button buttonType={ButtonType.secondaryLine} onClick={() => history.goBack()}>
          Back
        </Button>
      </ButtonWrapper>
    </>
  )
}
