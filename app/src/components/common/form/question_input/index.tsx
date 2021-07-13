import React, { ChangeEvent } from 'react'
import styled from 'styled-components'

import { Textfield } from '../..'
import { ConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { FormLabel } from '../form_label'

interface Props {
  context: ConnectedWeb3Context
  disabled: boolean
  name: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => any
  placeholder: string
  value: string
}

const TitleWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
`

export const QuestionInput = (props: Props) => {
  const { disabled, name = 'question', onChange, placeholder = 'Type in a question...', value } = props

  return (
    <>
      <TitleWrapper>
        <FormLabel>Set Market Question</FormLabel>
      </TitleWrapper>
      <Textfield
        autoComplete="off"
        disabled={disabled}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </>
  )
}
