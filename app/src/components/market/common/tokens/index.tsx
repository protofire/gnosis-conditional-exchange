import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

import { DEFAULT_TOKEN } from '../../../../common/constants'
import { ConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { useContracts } from '../../../../hooks'
import { getToken } from '../../../../util/networks'
import { Token } from '../../../../util/types'
import { Select } from '../../../common/form/select'

interface Props {
  autoFocus?: boolean
  context: ConnectedWeb3Context
  disabled?: boolean
  name: string
  onClick?: (event: React.MouseEvent<HTMLSelectElement>) => any
  onTokenChange: (token: Token) => any
  readOnly?: boolean
  value: Token
}

const FormOption = styled.option``

export const Tokens = (props: Props) => {
  const { context, onTokenChange, value, ...restProps } = props

  const defaultTokens = [getToken(context.networkId, DEFAULT_TOKEN)]
  const [tokens, setTokens] = useState<Token[]>(defaultTokens)
  const { kleros } = useContracts(context)

  useEffect(() => {
    const fetchTokens = async () => {
      const tokens = await kleros.queryTokens()
      setTokens(tokens)
    }

    fetchTokens()
  }, [kleros])

  const options = tokens.map(token => ({
    label: token.symbol,
    value: token.address,
  }))

  const onChange = (address: string) => {
    for (const token of tokens) {
      if (token.address === address) {
        onTokenChange(token)
      }
    }
  }

  return (
    <Select {...restProps} onChange={e => onChange(e.target.value)} value={value.address}>
      {options.map(option => {
        return (
          <FormOption key={option.value} value={option.value}>
            {option.label}
          </FormOption>
        )
      })}
    </Select>
  )
}
