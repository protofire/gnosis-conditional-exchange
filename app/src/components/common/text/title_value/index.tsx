import moment from 'moment-timezone'
import React, { DOMAttributes } from 'react'
import ReactTooltip from 'react-tooltip'
import styled from 'styled-components'

import { ValueStates } from '../../../market/common/transaction_details_row'

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 0px;
`

const Title = styled.h2<{ vertical: boolean | undefined }>`
  color: ${props => (props.vertical ? props.theme.colors.textColor : props.theme.colors.textColorLighter)};
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2;
  margin: 0 5px 0 0;
  white-space: nowrap;
`

const Value = styled.p<{ state: ValueStates; vertical: boolean | undefined }>`
  color: ${props =>
    props.state === ValueStates.success
      ? props.theme.colors.green
      : props.state === ValueStates.error
      ? props.theme.colors.error
      : props.vertical
      ? props.theme.colors.textColorDarker
      : props.theme.colors.textColorDark};
  font-size: 14px;
  font-weight: ${props => !props.vertical && '500'};
  line-height: 1.2;
  margin: 0;
  text-align: right;
  text-transform: capitalize;

  a {
    color: ${props =>
      props.state === ValueStates.success
        ? props.theme.colors.green
        : props.state === ValueStates.error
        ? props.theme.colors.error
        : props.vertical
        ? props.theme.colors.textColorDarker
        : props.theme.colors.textColor};
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }

  &:hover {
    &.tooltip {
      text-decoration: underline;
    }
  }
`

interface Props extends DOMAttributes<HTMLDivElement> {
  state?: ValueStates
  tooltip?: boolean
  date?: Date
  title: string
  value: any
  vertical?: boolean
}

export const TitleValue: React.FC<Props> = (props: Props) => {
  const { state = ValueStates.normal, title, value, tooltip, date, vertical, ...restProps } = props

  const now = moment()
  const localResolution = moment(date).local()

  //create message for when the market ends
  const endDate = date
  const endsText = moment(endDate).fromNow()
  const endsMessage = moment(endDate).isAfter(now) ? `Ends ${endsText}` : `Ended ${endsText}`

  //create message for local time
  const tzName = moment.tz.guess()
  const abbr = moment.tz(tzName).zoneAbbr()
  const formatting = `MMMM Do YYYY - HH:mm:ss [${abbr}]`

  return (
    <Wrapper {...restProps}>
      <Title vertical={vertical}>{title}</Title>
      <Value
        className={tooltip ? 'tooltip' : ''}
        data-delay-hide={tooltip ? '500' : ''}
        data-effect={tooltip ? 'solid' : ''}
        data-for={tooltip ? 'walletBalanceTooltip' : ''}
        data-multiline={tooltip ? 'true' : ''}
        data-tip={tooltip ? localResolution.format(formatting) + '<br />' + endsMessage : null}
        state={state}
        vertical={vertical}
      >
        {value}
      </Value>
      <ReactTooltip id="walletBalanceTooltip" />
    </Wrapper>
  )
}
