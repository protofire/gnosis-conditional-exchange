import React, { useState } from 'react'
import styled from 'styled-components'

import { ConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { Token } from '../../../../util/types'
import { FormRowLink } from '../../../common/form/form_row_link'
import { Tokens } from '../tokens'

import { ModalCollateral } from './modal_collateral'

interface Props {
  name: string
  onCollateralChange: (token: Token) => void
  value: Token
  customValues: Token[]
  addCustomValue: (collateral: Token) => void
  context: ConnectedWeb3Context
  disabled?: boolean
}

const Link = styled(FormRowLink)`
  display: block;
  margin-top: 5px;
  margin-left: auto;
`

export const CustomizableTokensSelect = (props: Props) => {
  const { addCustomValue, context, disabled = false, name, onCollateralChange, value } = props

  const [isModalCollateralOpen, setModalCollateralState] = useState(false)

  return (
    <>
      <Tokens context={context} disabled={disabled} name={name} onTokenChange={onCollateralChange} value={value} />
      <Link onClick={() => setModalCollateralState(true)}>Add custom token</Link>
      <ModalCollateral
        context={context}
        isOpen={isModalCollateralOpen}
        onClose={() => setModalCollateralState(false)}
        onSave={(collateral: Token) => {
          addCustomValue(collateral)
          onCollateralChange(collateral)
        }}
      />
    </>
  )
}
