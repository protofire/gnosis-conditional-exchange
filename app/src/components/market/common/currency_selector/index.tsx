import { BigNumber } from 'ethers/utils'
import React, { useEffect } from 'react'
import styled, { css } from 'styled-components'

import { ConnectedWeb3Context, useTokens } from '../../../../hooks'
import { bigNumberToString } from '../../../../util/tools'
import { Token } from '../../../../util/types'
import { Dropdown, DropdownItemProps, DropdownPosition } from '../../../common/form/dropdown'
import { Spinner } from '../../../common/spinner'
import { TokenItem } from '../token_item'

const Wrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 100%;
`

const CurrencyButtonSelectedCSS = css`
  border-color: ${props => props.theme.colors.primary};
  cursor: default;
  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
`

const CurrencyDropdown = styled(Dropdown)<{ selected: boolean }>`
  ${props => props.selected && CurrencyButtonSelectedCSS};
  width: 100%;
`

interface Props {
  currency?: Maybe<string>
  context: ConnectedWeb3Context
  disabled?: boolean
  filters?: Array<string>
  onSelect?: (currency: Token | null) => void
  balance?: string
  placeholder?: Maybe<string>
  addAll?: boolean
  addNativeAsset?: boolean
  addBalances?: boolean
  negativeFilter?: boolean
}

export const CurrencySelector: React.FC<Props> = props => {
  const {
    addAll = false,
    addNativeAsset = false,
    addBalances = false,
    balance,
    context,
    currency,
    disabled,
    filters = [],
    negativeFilter = false,
    onSelect,
    placeholder,
    ...restProps
  } = props

  const { refetch, tokens } = useTokens(context, addNativeAsset, addBalances, context.relay)

  useEffect(() => {
    refetch()
    // eslint-disable-next-line
  }, [balance])

  const currencyDropdownData: Array<DropdownItemProps> = []

  const onChange = (address: string) => {
    for (const token of tokens) {
      if (token.address === address && onSelect) {
        onSelect(token)
      }
    }
  }

  let currentItem: number | undefined

  if (addAll) {
    currencyDropdownData.push({
      content: 'All',
      onClick: () => {
        if (!disabled && onSelect) {
          onSelect(null)
        }
      },
    })
    currentItem = 0
  }

  const lowerCaseFilters = filters.map(address => address.toLowerCase())

  tokens
    .filter(({ address }) =>
      lowerCaseFilters.length === 0 || negativeFilter
        ? lowerCaseFilters.indexOf(address.toLowerCase()) === -1
        : lowerCaseFilters.indexOf(address.toLowerCase()) >= 0,
    )
    .forEach(({ address, balance: tokenBalance, decimals, image, symbol }, index) => {
      const selected = currency && currency.toLowerCase() === address.toLowerCase()
      currencyDropdownData.push({
        content: <TokenItem image={image} key={symbol} text={symbol} />,
        extraContent: selected ? balance : '',
        secondaryText: !tokenBalance
          ? ''
          : Number(tokenBalance) > 0
          ? bigNumberToString(new BigNumber(tokenBalance), decimals, 5)
          : '0',
        onClick: () => {
          if (!disabled) onChange(address)
        },
      })
      if (currency && currency.toLowerCase() === address.toLowerCase()) {
        currentItem = addAll ? index + 1 : index
      }
    })

  return (
    <Wrapper {...restProps}>
      <CurrencyDropdown
        currentItem={currentItem}
        disabled={disabled}
        dropdownPosition={DropdownPosition.center}
        items={currencyDropdownData}
        maxHeight={true}
        placeholder={currency && currentItem === undefined ? <Spinner size="18" /> : placeholder}
        selected={false}
      />
    </Wrapper>
  )
}
