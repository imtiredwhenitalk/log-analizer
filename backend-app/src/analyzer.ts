export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Detection = {
  id: string
  title: string
  attackType: string
  severity: Severity
  confidence: number
  occurrences: number
  description: string
  recommendation: string
  examples: { line: number; snippet: string }[]
}

export type AnalysisResult = {
  id: string
  fileName: string
  analyzedAt: string
  summary: {
    totalLines: number
    requestCount: number
    errorCount: number
    status4xx: number
    status5xx: number
    attackEvents: number
    findingCount: number
    criticalFindings: number
    uniqueIps: number
    averageResponseMs: number | null
  }
  detections: Detection[]
  topIps: { ip: string; count: number }[]
  methodCounts: Record<string, number>
  statusCounts: Record<string, number>
  disclaimer: string
}

type Rule = {
  id: string
  title: string
  attackType: string
  severity: Severity
  description: string
  recommendation: string
  patterns: RegExp[]
  threshold?: number
}

type Example = { line: number; snippet: string }

type LogLine = {
  number: number
  raw: string
  searchable: string
  ip?: string
}

const rules: Rule[] = [
  {
    id: 'sql-injection',
    title: 'SQL injection attempt',
    attackType: 'Injection',
    severity: 'critical',
    description: 'A request contains SQL operators or tools commonly used to alter a database query.',
    recommendation: 'Use parameterized queries, server-side input validation, and block repeated probing at the edge.',
    patterns: [
      /(?:union\s+(?:all\s+)?select|select\s+.+\s+from\s+.+\s+where)/i,
      /(?:%27|')\s*(?:or|and)\s+['\d]/i,
      /(?:\b(?:or|and)\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|['"]\s*(?:or|and)\s+['"]?[^\s'"]+['"]?\s*=)/i,
      /(?:sleep|benchmark)\s*\(/i,
      /\bsqlmap\b/i,
    ],
  },
  {
    id: 'xss',
    title: 'Cross-site scripting payload',
    attackType: 'XSS',
    severity: 'high',
    description: 'A request contains executable HTML or JavaScript that could be reflected or stored by the application.',
    recommendation: 'Escape output by context, sanitize HTML, set a strict Content-Security-Policy, and validate input.',
    patterns: [
      /<script(?:\s|>)/i,
      /(?:javascript:|vbscript:)/i,
      /\bon(?:error|load|click|mouseover)\s*=/i,
      /%3c\s*script/i,
    ],
  },
  {
    id: 'path-traversal',
    title: 'Path traversal attempt',
    attackType: 'Path traversal',
    severity: 'high',
    description: 'A path contains traversal sequences or sensitive operating-system files.',
    recommendation: 'Resolve paths against an allow-listed directory and reject normalized paths outside it.',
    patterns: [
      /(?:\.\.[/\\]){1,}/i,
      /%2e%2e(?:%2f|%5c)/i,
      /(?:etc[/\\]passwd|etc[/\\]shadow|windows[/\\]win\.ini)/i,
    ],
  },
  {
    id: 'command-injection',
    title: 'Command injection attempt',
    attackType: 'Command injection',
    severity: 'critical',
    description: 'A request appears to chain a shell command or invoke a system interpreter.',
    recommendation: 'Avoid shell interpolation, use safe process APIs with fixed arguments, and apply strict allow-lists.',
    patterns: [
      /(?:^|[;&|])\s*(?:curl|wget|nc|bash|sh|powershell|cmd(?:\.exe)?)(?:\s|$)/i,
      /(?:^|[;&|])\s*(?:cat|chmod|chown|id|whoami|uname|python(?:3)?|perl|ruby|node)(?:\s|$)/i,
      /(?:\/bin\/(?:ba)?sh|powershell\s+-e(?:nc)?|cmd\.exe\s+\/c)/i,
      /(?:\$\(|`[^`]+`)/i,
    ],
  },
  {
    id: 'ssrf',
    title: 'Server-side request forgery probe',
    attackType: 'SSRF',
    severity: 'high',
    description: 'A request targets loopback, cloud metadata, or another internal-only address.',
    recommendation: 'Allow-list outbound destinations, block private/link-local ranges, and validate redirects server-side.',
    patterns: [
      /169\.254\.169\.254/i,
      /metadata\.google\.internal/i,
      /(?:https?|ftp):\/\/(?:[^\s/@]+(?::[^\s/@]*)?@)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i,
      /(?:https?|ftp):\/\/(?:[^\s/@]+(?::[^\s/@]*)?@)?(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})(?::\d+)?(?:[/?\s]|$)/i,
    ],
  },
  {
    id: 'log4shell',
    title: 'JNDI / Log4Shell payload',
    attackType: 'Remote code execution',
    severity: 'critical',
    description: 'The log contains a JNDI lookup payload associated with Log4Shell exploitation attempts.',
    recommendation: 'Patch affected Log4j versions, remove message lookup behavior, and review outbound connections.',
    patterns: [
      /\$\{(?:jndi|lower|upper):/i,
      /(?:ldap|rmi|dns):\/\//i,
      /(?:java\.lang\.runtime|class\.forname)/i,
    ],
  },
  {
    id: 'scanner',
    title: 'Automated vulnerability scanning',
    attackType: 'Reconnaissance',
    severity: 'medium',
    description: 'A known scanner or security tool identifier was found in the request or user-agent.',
    recommendation: 'Rate-limit reconnaissance, keep exposed services minimal, and investigate the source IP and target paths.',
    patterns: [
      /\b(?:nmap|nikto|sqlmap|masscan|acunetix|nessus|burp|zgrab|wpscan)\b/i,
    ],
  },
  {
    id: 'brute-force',
    title: 'Possible credential brute force',
    attackType: 'Credential attack',
    severity: 'high',
    description: 'Repeated authentication failures suggest password guessing or credential stuffing.',
    recommendation: 'Add rate limits and progressive delays, enable MFA, and temporarily block abusive sources.',
    patterns: [
      /(?:failed\s+(?:password|login|authentication)|authentication\s+failure|invalid\s+(?:user|password)|login\s+failed|\b401\b)/i,
    ],
    threshold: 5,
  },
  {
    id: 'php-injection',
    title: 'Server-side code injection probe',
    attackType: 'Code injection',
    severity: 'critical',
    description: 'The request contains server-side execution markers often used to test unsafe file handling.',
    recommendation: 'Do not execute uploaded content, disable dangerous interpreters, and enforce content/type allow-lists.',
    patterns: [
      /(?:php:\/\/input|base64_decode\s*\(|\beval\s*\(|<%=?)/i,
    ],
  },
]

const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const methodPatterns = [
  /"?(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\S+/i,
  /["']?method["']?\s*[:=]\s*["']?(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i,
]
const statusPatterns = [
  /HTTP\/\d(?:\.\d)?\s+([1-5]\d{2})\b/i,
  /(?:status|code)[=: ]+([1-5]\d{2})\b/i,
  /["']?(?:status|statusCode|code)["']?\s*[:=]\s*["']?([1-5]\d{2})\b/i,
  /"\s*([1-5]\d{2})\s+(?:\d+|-)(?:\s|$)/,
]
const durationPatterns = [
  /(?:duration|response[_ -]?time|latency)[=: ]+(\d+(?:\.\d+)?)\s*ms/i,
  /["']?(?:duration|response[_ -]?time|latency)["']?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
  /(?:in|took)\s+(\d+(?:\.\d+)?)\s*ms/i,
]

function redactSensitiveData(value: string): string {
  return value
    .replace(/(authorization|token|password|secret|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .slice(0, 240)
}

function testPattern(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(value)
}

function decodeForSearch(value: string): string {
  let decoded = value.replace(/\+/g, ' ')
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      decoded = decoded.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
        try {
          return decodeURIComponent(encoded)
        } catch {
          return encoded
        }
      })
      break
    }
  }
  return decoded
}

function isValidIpv4(value: string): boolean {
  return value.split('.').map(Number).every((octet) => octet >= 0 && octet <= 255)
}

function toLogLines(content: string): LogLine[] {
  return content
    .replace(/\0/g, '')
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, number: index + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)
    .map(({ raw, number }) => {
      const ip = raw.match(ipv4Pattern)?.find(isValidIpv4)
      return ip
        ? { raw, number, searchable: decodeForSearch(raw), ip }
        : { raw, number, searchable: decodeForSearch(raw) }
    })
}

function matchesRule(line: LogLine, rule: Rule): boolean {
  return rule.patterns.some((pattern) => testPattern(pattern, line.searchable))
}

function getExamples(lines: LogLine[], rule: Rule): Example[] {
  const examples: Example[] = []
  lines.forEach((line) => {
    if (examples.length >= 5) return
    if (matchesRule(line, rule)) {
      examples.push({ line: line.number, snippet: redactSensitiveData(line.raw.trim()) })
    }
  })
  return examples
}

function getConfidence(rule: Rule, occurrences: number): number {
  const baseline = rule.threshold ? 73 : 78
  return Math.min(99, baseline + Math.min(20, occurrences * 3))
}

function collectStats(lines: LogLine[]) {
  const methodCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = {}
  const ipCounts = new Map<string, number>()
  let requestCount = 0
  let status4xx = 0
  let status5xx = 0
  let responseTotal = 0
  let responseSamples = 0

  lines.forEach((line) => {
    const methodMatch = methodPatterns.map((pattern) => line.searchable.match(pattern)).find(Boolean)
    const method = methodMatch?.[1]?.toUpperCase() ?? methodMatch?.[2]?.toUpperCase()
    if (method) {
      methodCounts[method] = (methodCounts[method] ?? 0) + 1
      requestCount += 1
    }

    const status = statusPatterns.map((pattern) => line.searchable.match(pattern)?.[1]).find(Boolean)
    if (status) {
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
      if (status.startsWith('4')) status4xx += 1
      if (status.startsWith('5')) status5xx += 1
    }

    const addresses = line.raw.match(ipv4Pattern) ?? []
    addresses.forEach((ip) => {
      if (isValidIpv4(ip)) {
        ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1)
      }
    })

    const duration = durationPatterns.map((pattern) => line.searchable.match(pattern)?.[1]).find(Boolean)
    if (duration) {
      responseTotal += Number(duration)
      responseSamples += 1
    }
  })

  return {
    methodCounts,
    statusCounts,
    requestCount,
    status4xx,
    status5xx,
    responseTotal,
    responseSamples,
    uniqueIps: ipCounts.size,
    topIps: [...ipCounts.entries()]
      .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
  }
}

export function analyzeLog(fileName: string, content: string): AnalysisResult {
  const lines = toLogLines(content)
  const stats = collectStats(lines)
  const detections: Detection[] = []

  rules.forEach((rule) => {
    const matchingLines = lines.filter((line) => matchesRule(line, rule))
    const matchingBySource = new Map<string, number>()
    matchingLines.forEach((line) => {
      const source = line.ip ?? 'unknown'
      matchingBySource.set(source, (matchingBySource.get(source) ?? 0) + 1)
    })
    const qualifyingLines = rule.threshold
      ? matchingLines.filter((line) => {
        const source = line.ip ?? 'unknown'
        return (matchingBySource.get(source) ?? 0) >= rule.threshold!
      })
      : matchingLines
    const occurrences = qualifyingLines.length
    const examples = getExamples(qualifyingLines, rule)
    if (rule.threshold && occurrences < rule.threshold) return
    if (occurrences === 0) return

    detections.push({
      id: rule.id,
      title: rule.title,
      attackType: rule.attackType,
      severity: rule.severity,
      confidence: getConfidence(rule, occurrences),
      occurrences,
      description: rule.description,
      recommendation: rule.recommendation,
      examples,
    })
  })

  const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  detections.sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity])
  const criticalFindings = detections.filter((detection) => detection.severity === 'critical' || detection.severity === 'high').length
  const averageResponseMs = stats.responseSamples > 0 ? Math.round(stats.responseTotal / stats.responseSamples) : null

  return {
    id: crypto.randomUUID(),
    fileName,
    analyzedAt: new Date().toISOString(),
    summary: {
      totalLines: lines.length,
      requestCount: stats.requestCount,
      errorCount: stats.status4xx + stats.status5xx,
      status4xx: stats.status4xx,
      status5xx: stats.status5xx,
      attackEvents: detections.reduce((total, detection) => total + detection.occurrences, 0),
      findingCount: detections.length,
      criticalFindings,
      uniqueIps: stats.uniqueIps,
      averageResponseMs,
    },
    detections,
    topIps: stats.topIps,
    methodCounts: stats.methodCounts,
    statusCounts: stats.statusCounts,
    disclaimer: 'Findings are based on log signatures and indicate suspicious activity; verify them against application and infrastructure telemetry.',
  }
}
