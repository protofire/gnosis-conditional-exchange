import { css } from 'styled-components'

const DefaultTooltip = css`
  &.__react_component_tooltip.type-light {
    &.place-top:after {
      border: 0 solid ${props => props.theme.borders.borderColor} !important;
    }

    font-size: ${props => props.theme.fonts.defaultSize};
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
    letter-spacing: 0.1px;
    text-align: left;
    background-color: ${props => props.theme.white};
    opacity: 1;
    border-radius: ${props => props.theme.borders.commonBorderRadius};
    box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid ${props => props.theme.borders.tooltip};
  }
`

export const ReactTooltipStylesOverride = css`
  .customTooltip {
    background-color: #313131;
    color: #fff;
    font-size: 11px;
    line-height: 1.3;
    max-width: 180px;
    opacity: 1;
    padding: 5px 8px;
    text-align: left;

    > a {
      color: #fff;
      text-decoration: underline;
    }
    > a:hover {
      color: #00f;
    }

    &.place-left:after {
      border-left-color: #000;
    }

    &.place-right:after {
      border-right-color: #000;
    }

    &.place-top:after {
      border-top-color: #000;
    }

    &.place-bottom:after {
      border-bottom-color: #000;
    }

    .multi-line {
      text-align: left;
    }

    &.__react_component_tooltip.type-dark.place-top:after {
      border-top-color: #313131;
      border-top-width: 10px;
      bottom: -8px;
    }
  }

  .customMarketTooltip {
    ${DefaultTooltip}
  }

  .scalarValueTooltip {
    ${DefaultTooltip};
    padding: 5px 8px !important;
    font-weight: 500 !important;
  }
`
