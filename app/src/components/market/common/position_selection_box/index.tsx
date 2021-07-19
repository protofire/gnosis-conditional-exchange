import React from 'react'
import styled from 'styled-components'

import { bigNumberToString, isDust, reverseArray } from '../../../../util/tools'
import { BalanceItem } from '../../../../util/types'
import { RadioInput } from '../../../common'

const PositionSelectionBoxWrapper = styled.div`
  height: 88px;
  border: ${props => props.theme.borders.borderLineDisabled};
  border-radius: ${props => props.theme.cards.borderRadius};
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 20px;
`

const PositionSelectionBoxItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const PositionSelectionLeft = styled.div`
  display: flex;
  align-items: center;
`

const PositionSelectionTitle = styled.p`
  text-transform: capitalize;
  margin: 0;
  margin-left: 12px;
  font-size: ${props => props.theme.textfield.fontSize};
  color: ${props => props.theme.textfield.color};
`

const PositionSelectionAmount = styled.p`
  margin: 0;
  font-size: ${props => props.theme.textfield.fontSize};
  color: ${props => props.theme.colors.textColor};
`

interface Props {
  balances: BalanceItem[]
  positionIndex: number
  setBalanceItem: React.Dispatch<React.SetStateAction<BalanceItem>>
  setPositionIndex: React.Dispatch<React.SetStateAction<number>>
  decimals: number
}

export const PositionSelectionBox = (props: Props) => {
  const { balances, decimals, positionIndex, setBalanceItem, setPositionIndex } = props

  const reversedBalances: BalanceItem[] = reverseArray(balances)

  const renderPositionSelectionItem = (balance: BalanceItem) => {
    return (
      <PositionSelectionBoxItem>
        <PositionSelectionLeft
          onClick={() => {
            if (!isDust(balance.shares, decimals)) {
              setBalanceItem(balance)
              setPositionIndex(balances.indexOf(balance))
            }
          }}
        >
          <RadioInput
            checked={balances.indexOf(balance) === positionIndex}
            disabled={isDust(balance.shares, decimals)}
            name={'position'}
            onClick={() => {
              setBalanceItem(balance)
              setPositionIndex(balances.indexOf(balance))
            }}
            outcomeIndex={-1}
          />
          <PositionSelectionTitle>{balance.outcomeName}</PositionSelectionTitle>
        </PositionSelectionLeft>
        <PositionSelectionAmount>{bigNumberToString(balance.shares, decimals)} Shares</PositionSelectionAmount>
      </PositionSelectionBoxItem>
    )
  }

  return (
    <PositionSelectionBoxWrapper>
      {reversedBalances.map(balance => renderPositionSelectionItem(balance))}
    </PositionSelectionBoxWrapper>
  )
}
