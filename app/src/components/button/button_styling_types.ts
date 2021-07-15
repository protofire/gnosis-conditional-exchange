import { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { css } from 'styled-components'

export enum ButtonType {
  primary,
  primaryLine,
  secondary,
  secondaryLine,
}

export interface ButtonCommonProps {
  buttonType?: ButtonType
  theme?: any
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonCommonProps {}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonCommonProps {}

const PrimaryCSS = css`
  & {
    background-color: ${props => props.theme.primary1};
    border-color: ${props => props.theme.primary1};
    color: ${props => props.theme.white};
  }

  &:hover {
    background-color: ${props => props.theme.primary3};
    border-color: ${props => props.theme.primary3};
    color: ${props => props.theme.white};
  }

  &[disabled],
  &[disabled]:hover {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.primary4};
    color: ${props => props.theme.text2};
    cursor: not-allowed;
  }
`

const PrimaryLineCSS = css`
  & {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.border1};
    color: ${props => props.theme.text1};
  }

  &:hover {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.border2};
    color: ${props => props.theme.text1};
  }

  &[disabled],
  &[disabled]:hover {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.primary4};
    color: ${props => props.theme.text1};
    cursor: not-allowed;
  }
`

const SecondaryCSS = css`
  & {
    background-color: ${props => props.theme.primary4};
    border-color: ${props => props.theme.primary4};
    color: ${props => props.theme.primary3};
    font-weight: ${props => props.theme.buttonSecondary.weight};
  }

  &:hover {
    background-color: ${props => props.theme.primary4};
    border-color: ${props => props.theme.primary4};
    color: ${props => props.theme.primary3};
  }

  &[disabled],
  &[disabled]:hover {
    background-color: ${props => props.theme.primary4};
    border-color: ${props => props.theme.primary4};
    color: ${props => props.theme.primary3};
    cursor: not-allowed;
  }
`

const SecondaryLineCSS = css`
  & {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.border1};
    color: ${props => props.theme.text1};
  }

  &:hover {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.border2};
    color: ${props => props.theme.text1};
  }

  &[disabled],
  &[disabled]:hover {
    background-color: ${props => props.theme.white};
    border-color: ${props => props.theme.border1};
    color: ${props => props.theme.text1};
    cursor: not-allowed;
  }
`

const getButtonTypeStyles = (buttonType: ButtonType = ButtonType.primaryLine): any => {
  if (buttonType === ButtonType.primary) {
    return PrimaryCSS
  }

  if (buttonType === ButtonType.secondary) {
    return SecondaryCSS
  }

  if (buttonType === ButtonType.primaryLine) {
    return PrimaryLineCSS
  }

  if (buttonType === ButtonType.secondaryLine) {
    return SecondaryLineCSS
  }

  return PrimaryCSS
}

export const ButtonCSS = css`
  align-items: center;
  border-radius: 8px;
  border-style: solid;
  border-width: 1px;
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.fonts.defaultSize};
  line-height: ${({ theme }) => theme.fonts.defaultLineHeight};
  font-weight: 400;
  height: 40px;
  justify-content: center;
  letter-spacing: 0.2px;
  outline: none;
  padding: 12px 17px;
  pointer-events: ${props => ((props as any).disabled ? 'none' : 'initial')};
  text-align: center;
  transition: all 0.15s ease-out;
  user-select: none;
  white-space: nowrap;
  font-family: Roboto;

  ${props => getButtonTypeStyles((props as any).buttonType)}
`
