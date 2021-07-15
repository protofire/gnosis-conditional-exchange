import { createGlobalStyle } from 'styled-components'

import { DatepickerStylesOverride } from './overrides/datepicker_styles_override'
import { ReactTooltipStylesOverride } from './overrides/react_tooltip_styles_override'
import { ThreeboxStylesOverride } from './overrides/threebox_styles_override'

export const GlobalStyle = createGlobalStyle<any>`
    html body {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      background-color: ${props => props.theme.white};
      font-family: ${props => props.theme.fonts.fontFamily};
      font-size: ${props => props.theme.fonts.defaultSize};
    }
      code {
        font-family: ${props => props.theme.fonts.fontFamilyCode};
    }
      body,
      html,
      #root {
        height: 100vh;
      }
      
    ${DatepickerStylesOverride}
    ${ReactTooltipStylesOverride}
    ${ThreeboxStylesOverride}
`
