param([switch]$Restore)
$ErrorActionPreference = 'Stop'
Start-Transcript -LiteralPath (Join-Path $PSScriptRoot '../artifacts/firewall-setup.log') -Force | Out-Null
$echoNodePath = 'C:\Users\zewen\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$echoRuleName = 'EchoHome-LAN-5173'
$echoBlockPrefix = 'TCP Query User{D974720A-A9A5-487A-98CB-1F77D0250CF8}*'
$echoIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$echoPrincipal = [Security.Principal.WindowsPrincipal]::new($echoIdentity)
if (-not $echoPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to configure the LAN firewall rule.'
}
$echoBlocks = @(Get-NetFirewallApplicationFilter -Program $echoNodePath | Get-NetFirewallRule | Where-Object { $_.Name -like $echoBlockPrefix -and $_.Action -eq 'Block' -and $_.Direction -eq 'Inbound' })
if ($echoBlocks.Count -ne 1) { throw 'The expected existing Node TCP block rule was not found uniquely.' }
$echoFilter = $echoBlocks[0] | Get-NetFirewallPortFilter
if ($echoFilter.Protocol -ne 'TCP') { throw 'The existing rule is not a TCP rule.' }
if ($Restore) {
    Get-NetFirewallRule -Name $echoRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    $echoFilter | Set-NetFirewallPortFilter -LocalPort Any
    Write-Output 'Original Node TCP block restored; Echo LAN exception removed.'
    Stop-Transcript | Out-Null
    exit 0
}
$echoCurrentPorts = @($echoFilter.LocalPort) -join ','
if ($echoCurrentPorts -notin @('Any', '1-5172,5174-65535')) { throw 'The existing rule has changed; no firewall updates were made.' }
$echoEthernet = Get-NetIPAddress -AddressFamily IPv4 -IPAddress '192.168.31.206'
try {
    $echoExisting = Get-NetFirewallRule -Name $echoRuleName -ErrorAction SilentlyContinue
    if (-not $echoExisting) {
        New-NetFirewallRule -Name $echoRuleName -DisplayName 'Echo Home - trusted LAN TCP 5173' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Program $echoNodePath -InterfaceAlias $echoEthernet.InterfaceAlias -RemoteAddress LocalSubnet -Profile Any | Out-Null
    }
    $echoFilter | Set-NetFirewallPortFilter -LocalPort @('1-5172', '5174-65535')
} catch {
    if (-not $echoExisting) { Get-NetFirewallRule -Name $echoRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule }
    throw
}
Write-Output 'Echo LAN access enabled on Ethernet for local-subnet TCP port 5173 only.'
Stop-Transcript | Out-Null
