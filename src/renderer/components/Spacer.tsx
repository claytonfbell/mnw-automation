import * as React from "react"

interface SpacerProps {
  size?: "large" | "medium"
}

function Spacer({ size = "medium" }: SpacerProps) {
  let height = 16
  height = size === "large" ? 32 : height
  return <div style={{ height }} />
}
export default Spacer
