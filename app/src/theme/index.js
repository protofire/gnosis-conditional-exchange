const theme = {
  fonts: {
    defaultSize: '14px',
    fontFamily: `'Roboto', 'Helvetica Neue', 'Arial', 'Segoe UI', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', '-apple-system', 'BlinkMacSystemFont', sans-serif`,
    fontFamilyCode: `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace`,
  },
  buttonPrimary: {
    backgroundColor: '#5C6BC0',
    backgroundColorDisabled: '#5C6BC0',
    borderColor: '#5C6BC0',
    borderColorDisabled: '#5C6BC0',
    backgroundColorHover: '#3F51B5',
    borderColorHover: '#3F51B5',
    color: '#fff',
    colorDisabled: '#fff',
    colorHover: '#fff',
  },
  buttonPrimaryLine: {
    backgroundColor: '#fff',
    backgroundColorDisabled: '#fff',
    backgroundColorHover: '#fff',
    borderColor: '#DCDFF2',
    borderColorDisabled: '#E8EAF6',
    borderColorHover: '#C5CAE9',
    color: '#37474F',
    colorDisabled: '#757575',
    colorHover: '#37474F',
  },
  buttonSecondary: {
    backgroundColor: '#E8EAF6',
    backgroundColorDisabled: '#E8EAF6',
    backgroundColorHover: '#E8EAF6',
    borderColor: '#E8EAF6',
    borderColorDisabled: '#E8EAF6',
    borderColorHover: '#E8EAF6',
    color: '#3F51B5',
    colorDisabled: '#3F51B5',
    colorHover: '#3F51B5',
    weight: '500',
  },
  buttonSecondaryLine: {
    backgroundColor: '#fff',
    backgroundColorDisabled: '#fff',
    backgroundColorHover: '#fff',
    borderColor: '#DCDFF2',
    borderColorDisabled: '#DCDFF2',
    borderColorHover: '#C5CAE9',
    color: '#37474F',
    colorDisabled: '#757575',
    colorHover: '#37474F',
  },
  dropdown: {
    buttonBackgroundColor: '#fff',
    buttonBackgroundColorHover: '#fff',
    buttonBorderColor: '#DCDFF2',
    buttonBorderColorHover: '#C5CAE9',
    buttonColor: '#37474F',
    buttonColorHover: '#37474F',
    dropdownItems: {
      backgroundColor: '#fff',
      borderColor: '#E8EAF6',
      borderRadius: '12px',
      boxShadow: '0px 0px 6px rgba(0, 0, 0, 0.12)',
      item: {
        backgroundColor: 'transparent',
        backgroundColorActive: '#F8F9FC',
        backgroundColorHover: '#F8F9FC',
        color: '#37474F',
      },
    },
  },
  buttonCircle: {
    dimensions: '34px',
  },
  colors: {
    activeListItemBackground: '#fafafa',
    alert: '#E57373',
    darkGray: '#acacac',
    error: '#fa0000',
    gray: '#b7b7b7',
    green: '#4B9E98',
    mainBodyBackground: '#fff',
    primary: '#3F51B5',
    primaryLight: '#5C6BC0',
    hyperlink: '#1E88E5',
    secondary: '#EDEFF8',
    tertiary: '#DCDFF2',
    tertiaryDark: '#C5CAE9',
    textColor: '#757575',
    textColorDark: '#37474F',
    textColorDarker: '#333',
    textColorLight: '#999',
    textColorLighter: '#86909E',
    textColorLightish: '#7D8189',
    verticalDivider: '#e8eaf6',
    clickable: '#7986CB',
  },
  message: {
    colors: {
      error: '#ff7848',
      default: '#ECEFF1',
      ok: '#00bc93',
      warning: '#f5e148',
    },
  },
  cards: {
    backgroundColor: '#fff',
    border: '1px solid #EEE',
    borderRadius: '8px ',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    paddingHorizontal: '25px',
    paddingVertical: '25px',
    textColor: '#000',
    textColorSecondary: '#333',
    titleColor: '#000',
  },
  header: {
    backgroundColor: '#fff',
    boxShadow: 'none',
    height: '66px',
    color: '#37474F',
  },
  themeBreakPoints: {
    lg: '992px',
    md: '768px',
    sm: '480px',
    xl: '1024px',
    xs: '320px',
    xxl: '1280px',
    xxxl: '1366px',
  },
  borders: {
    tooltip: '#cfd8dc',
    borderColor: '#ECEFF1',
    borderDisabled: '#E8EAF6',
    commonBorderRadius: '6px',
  },
  slider: {
    idle: '#E8EAF6',
    active: '#9FA8DA',
  },
  paddings: {
    mainPadding: '15px',
  },
  textfield: {
    backgroundColor: 'transparent',
    borderColor: '#DCDFF2',
    borderColorActive: '#9FA8DA',
    borderColorOnHover: '#C5CAE9',
    borderRadius: '32px',
    borderStyle: 'solid',
    borderWidth: '1px',
    color: '#37474F',
    fontSize: '14px',
    fontWeight: '500',
    height: '36px',
    outline: 'none',
    paddingHorizontal: '25px',
    paddingVertical: '10px',
    placeholderColor: '#86909E',
    placeholderFontSize: '14px',
    placeholderFontWeight: '400',
  },
  mainContainer: {
    maxWidth: '586px',
  },
  form: {
    common: {
      disabled: {
        backgroundColor: '#fff',
        borderColor: '#E8EAF6',
        color: '#757575',
      },
    },
  },
  outcomes: {
    colors: [
      {
        darker: '#8E24AA',
        medium: '#e1bee7',
      },
      {
        darker: '#00897B',
        medium: '#b2dfdb',
      },
      {
        darker: '#d2b994',
        medium: '#ffe0b2',
      },
      {
        darker: '#b9b992',
        medium: '#e7e7be',
      },
      {
        darker: '#9db992',
        medium: '#bedfb2',
      },
      {
        darker: '#ca89bd',
        medium: '#ffb2f0',
      },
      {
        darker: '#cc9c9c',
        medium: '#e7bebe',
      },
      {
        darker: '#9ebd91',
        medium: '#bfdfb2',
      },
      {
        darker: '#af7171',
        medium: '#ffb2b2',
      },
      {
        darker: '#6d9677',
        medium: '#90bb9b',
      },
      {
        darker: '#7b91a9',
        medium: '#b2c8df',
      },
      {
        darker: '#a980c3',
        medium: '#e1b2ff',
      },
      {
        darker: '#b18bac',
        medium: '#e7bee2',
      },
      {
        darker: '#484343',
        medium: '#757575',
      },
      {
        darker: '#b38037',
        medium: '#f0ad4e',
      },
      {
        darker: '#acb8c1',
        medium: '#e3f2fd',
      },
      {
        darker: '#679053',
        medium: '#8dc572',
      },
      {
        darker: '#131a1d',
        medium: '#37474f',
      },
      {
        darker: '#17486f',
        medium: '#216ba5',
      },
      {
        darker: '#7e97ad',
        medium: '#bbdefb',
      },
      {
        darker: '#879caf',
        medium: '#d6ebfd',
      },
      {
        darker: '#265986',
        medium: '#337ab7',
      },
      {
        darker: '#0e488a',
        medium: '#1565c0',
      },
      {
        darker: '#4d535d',
        medium: '#86909e',
      },
      {
        darker: '#6b3838',
        medium: '#be6464',
      },
      {
        darker: '#313f46',
        medium: '#607d8b',
      },
      {
        darker: '#464646',
        medium: '#9e9e9e',
      },
      {
        darker: '#3c2922',
        medium: '#795548',
      },
      {
        darker: '#a03716',
        medium: '#ff5722',
      },
      {
        darker: '#c17300',
        medium: '#ff9800',
      },
      {
        darker: '#b1a325',
        medium: '#ffeb3b',
      },
      {
        darker: '#a51546',
        medium: '#e91e63',
      },
    ],
  },
  modalStyle: {
    content: {
      backgroundColor: '#fff',
      borderColor: '#ECEFF1',
      borderRadius: '6px',
      borderStyle: 'solid',
      borderWidth: '1px',
      bottom: 'auto',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '0',
      height: 'fit-content',
      left: 'auto',
      margin: 'auto 0',
      overflow: 'hidden',
      padding: '25px',
      position: 'relative',
      right: 'auto',
      top: 'auto',
      width: '355px',
    },
    overlay: {
      alignItems: 'unset',
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
      display: 'flex',
      justifyContent: 'center',
      overflow: 'auto',
      padding: '10px',
      zIndex: '12345',
    },
  },
  progressBar: {
    open: '#7986CB',
    finalizing: '#9575CD',
    arbitration: '#BA68C8',
    closed: '#BA68C8',
  },
}

export default theme
