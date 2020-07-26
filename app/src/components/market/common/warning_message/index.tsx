import React from 'react'
import styled from 'styled-components'

import { Alert } from './img/Alert'

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.borders.borderColorLighter};
  align-content: center;
  padding: 4px 20px;
  margin-bottom: 20px;
`

const AlertWrapper = styled.div`
  align-items: center;
  display: flex;
  padding-right: 16px;
`

const Description = styled.p`
  color: ${props => props.theme.colors.textColorLightish};
  font-size: 14px;
  line-height: 1.4;
  letter-spacing: 0.1px;
  width: 100%;

  &.danger {
    color: ${props => props.theme.message.colors.error};
  }
`

const Hyperlink = styled.a`
  color: ${props => props.theme.colors.hyperlink};
`

interface Props {
  description: string
  hyperlinkDescription: string
  href: string
  additionalDescription: string
  danger?: boolean
}

export const WarningMessage = (props: Props) => {
  const { additionalDescription, danger, description, href, hyperlinkDescription, ...restProps } = props
  return (
    <Wrapper {...restProps}>
      <AlertWrapper>
        <Alert />
      </AlertWrapper>
      <Description className={danger ? 'danger' : ''}>
        {description}{' '}
        <Hyperlink href={href} target="_blank">
          {hyperlinkDescription}
        </Hyperlink>
        <span>{additionalDescription}</span>
      </Description>
    </Wrapper>
  )
}
