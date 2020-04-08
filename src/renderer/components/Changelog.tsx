import * as React from "react"
import * as ReactMarkdown from "react-markdown"
import changelog from "../../changelog.md"

export default function Changelog() {
  return <ReactMarkdown className="markdown-body" source={changelog} />
}
