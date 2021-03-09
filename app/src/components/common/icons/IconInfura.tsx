import React from 'react'

interface Props {
  size?: string
}

export const IconInfura = (props: Props) => {
  const { size = '24' } = props
  return (
    <svg fill="none" height={size} viewBox="0 0 25 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.5 12C0.5 5.37258 5.87258 0 12.5 0C19.1274 0 24.5 5.37258 24.5 12C24.5 18.6274 19.1274 24 12.5 24C5.87258 24 0.5 18.6274 0.5 12Z"
        fill="#FF6B4A"
      />
      <path
        d="M6.84976 7V8.52163L10.5502 8.14721H11.9161V10.6103L9.61614 11.3014L6.5 12.0398L6.96262 13.5274L9.94895 12.4002L11.9161 11.8098V15.853H10.5502L6.84976 15.4784V17H18.1502V15.4784L14.4498 15.853H13.0838V11.8098L15.0412 12.3972L18.0375 13.5274L18.4999 12.0398L15.3922 11.3036L13.0838 10.6103V8.14721H14.4498L18.1502 8.52163V7H6.84976Z"
        fill="white"
      />
    </svg>
  )
}
