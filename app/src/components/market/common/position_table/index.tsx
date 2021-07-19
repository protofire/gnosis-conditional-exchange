import { BigNumber } from 'ethers/utils'
import React from 'react'
import styled from 'styled-components'

import { bigNumberToString, formatNumber, isDust } from '../../../../util/tools'
import { BalanceItem, PositionTableValue, Token } from '../../../../util/types'
import { TD, THead, TR, Table } from '../../../common'
import {
  OutcomeItemLittleBallOfJoyAndDifferentColors,
  OutcomeItemText,
  OutcomeItemTextWrapper,
  PaddingCSS,
  TDStyled,
  THStyled,
} from '../../common/common_styled'

const TableWrapper = styled.div`
  margin-left: -24px
  margin-right: -24px
`

const ColoredTDStyled = styled(TDStyled as any)<{ positive?: boolean | undefined }>`
  color: ${props =>
    props.positive ? props.theme.scale.positiveText : props.positive === false ? props.theme.scale.negativeText : ''};
`

const TDPosition = styled(TD as any)`
  ${PaddingCSS}
  font-weight: 400;
`

interface Props {
  balances: BalanceItem[]
  collateral: Token
  fee: BigNumber | null | undefined
  longPayout: number
  shortPayout: number
  longProfitLoss: number
  shortProfitLoss: number
  longProfitLossPercentage: number
  shortProfitLossPercentage: number
}

export const PositionTable = (props: Props) => {
  const {
    balances,
    collateral,
    longPayout,
    longProfitLoss,
    longProfitLossPercentage,
    shortPayout,
    shortProfitLoss,
    shortProfitLossPercentage,
  } = props

  const shortShares = balances[0].shares
  const longShares = balances[1].shares
  const shortSharesFormatted = bigNumberToString(shortShares || new BigNumber(0), collateral.decimals)
  const longSharesFormatted = bigNumberToString(longShares || new BigNumber(0), collateral.decimals)

  const isShortPositive = shortProfitLoss > 0 ? true : shortProfitLoss < 0 ? false : undefined
  const isLongPositive = longProfitLoss > 0 ? true : longProfitLoss < 0 ? false : undefined

  const TableHead: PositionTableValue[] = [
    PositionTableValue.YourPosition,
    PositionTableValue.Shares,
    PositionTableValue.Payout,
    PositionTableValue.ProfitLoss,
  ]

  const TableCellsAlign = ['left', 'right', 'right', 'right']

  const renderTableHeader = () => {
    return (
      <THead>
        <TR>
          {TableHead.map((value, index) => {
            return (
              <THStyled key={index} textAlign={TableCellsAlign[index]}>
                {value} {value === PositionTableValue.Payout && `(${collateral.symbol})`}
              </THStyled>
            )
          })}
        </TR>
      </THead>
    )
  }

  const renderTableRow = (index: number) => {
    if (index === 0 && isDust(shortShares || new BigNumber(0), collateral.decimals)) return
    if (index === 1 && isDust(longShares || new BigNumber(0), collateral.decimals)) return
    return (
      <TR key={index}>
        <TDPosition textAlign={TableCellsAlign[0]}>
          <OutcomeItemTextWrapper>
            <OutcomeItemLittleBallOfJoyAndDifferentColors outcomeIndex={index} />
            <OutcomeItemText>{index === 0 ? 'Short' : 'Long'}</OutcomeItemText>
          </OutcomeItemTextWrapper>
        </TDPosition>
        <ColoredTDStyled textAlign={TableCellsAlign[1]}>
          {index === 0 ? shortSharesFormatted : longSharesFormatted}
        </ColoredTDStyled>
        <ColoredTDStyled positive={index === 0 ? isShortPositive : isLongPositive} textAlign={TableCellsAlign[2]}>
          {index === 0 ? formatNumber(shortPayout.toString()) : formatNumber(longPayout.toString())}
        </ColoredTDStyled>
        <ColoredTDStyled positive={index === 0 ? isShortPositive : isLongPositive} textAlign={TableCellsAlign[3]}>
          {index === 0
            ? `${shortProfitLoss >= shortPayout ? '--' : formatNumber(shortProfitLoss.toString())} (${
                shortProfitLossPercentage === Infinity ? '--' : formatNumber(shortProfitLossPercentage.toString())
              }%)`
            : `${longProfitLoss >= longPayout ? '--' : formatNumber(longProfitLoss.toString())} (${
                longProfitLossPercentage === Infinity ? '--' : formatNumber(longProfitLossPercentage.toString())
              }%)`}
        </ColoredTDStyled>
      </TR>
    )
  }

  const renderTable = () => {
    return [0, 1].map(index => renderTableRow(index))
  }

  return (
    <TableWrapper>
      <Table head={renderTableHeader()}>{renderTable()}</Table>
    </TableWrapper>
  )
}
