import React, { DOMAttributes } from 'react'
import styled from 'styled-components'

import { IconInfo } from '../../../common/icons'
import { Circle } from '../../common/common_styled'

export enum ValueStates {
  error,
  important,
  normal,
  success,
}

const Wrapper = styled.div`
  display: flex;
  font-size: 14px;
  justify-content: space-between;
  letter-spacing: 0.4px;
  line-height: 1.2;
  margin: 0 0 14px;

  &:last-child {
    margin-bottom: 0;
  }
`

const Title = styled.h4`
  color: #424242;
  font-weight: 400;
  margin: 0;
  opacity: 0.9;
  display: flex;
  align-items: center;
`

const Value = styled.p<{ state: ValueStates; emphasizeValue?: boolean }>`
  color: ${props =>
    (!props.emphasizeValue && props.state === ValueStates.success && props.theme.colors.textColorLightish) ||
    (props.state === ValueStates.success && props.theme.colors.green) ||
    (props.state === ValueStates.error && props.theme.colors.error) ||
    (props.state === ValueStates.important && props.theme.colors.textColorDark) ||
    props.theme.colors.textColorLightish};
    };
  font-weight: ${props => (props.emphasizeValue ? '500' : '400')};
  margin: 0;
`

interface Props extends DOMAttributes<HTMLDivElement> {
  emphasizeValue?: boolean
  state?: ValueStates
  tooltip?: string
  title: string
  value: string
}

export const TransactionDetailsRow: React.FC<Props> = props => {
  const { emphasizeValue = false, state = ValueStates.normal, title, value, tooltip, ...restProps } = props

  return (
    <Wrapper {...restProps}>
      <Title>
        {title}
        {tooltip ? (
          <Circle
            data-delay-hide={tooltip ? '500' : ''}
            data-effect={tooltip ? 'solid' : ''}
            data-for={tooltip ? 'walletBalanceTooltip' : ''}
            data-multiline={tooltip ? 'true' : ''}
            data-tip={tooltip ? tooltip : null}
          >
            <IconInfo />
          </Circle>
        ) : null}
      </Title>
      <Value emphasizeValue={emphasizeValue} state={state}>
        {value}
      </Value>
    </Wrapper>
  )
}
