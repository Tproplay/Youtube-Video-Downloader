' start-hidden.vbs - Runs the YouTube Downloader server in the background without a console window
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Find Node.js executable
Dim nodeExe
nodeExe = ""

Function FileExists(path)
    FileExists = FSO.FileExists(path)
End Function

' 0. Check bundled bin\node.exe first (self-contained portable mode)
Dim bundledNode
bundledNode = ScriptDir & "\bin\node.exe"
If FileExists(bundledNode) Then
    nodeExe = """" & bundledNode & """"
End If

' 1. Check known common Node installation paths
If nodeExe = "" Then
    Dim candidatePaths(3)
    candidatePaths(0) = "C:\Program Files\nodejs\node.exe"
    candidatePaths(1) = "C:\Program Files (x86)\nodejs\node.exe"
    candidatePaths(2) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe")
    candidatePaths(3) = WshShell.ExpandEnvironmentStrings("%APPDATA%\npm\node.exe")

    Dim i
    For i = 0 To UBound(candidatePaths)
        If FileExists(candidatePaths(i)) Then
            nodeExe = """" & candidatePaths(i) & """"
            Exit For
        End If
    Next
End If

' 2. Fallback to system PATH
If nodeExe = "" Then
    On Error Resume Next
    Dim testRun
    testRun = WshShell.Run("node -v", 0, True)
    If Err.Number = 0 And testRun = 0 Then
        nodeExe = "node"
    End If
    On Error GoTo 0
End If

If nodeExe = "" Then
    MsgBox "Node.js was not found on your system." & vbCrLf & vbCrLf & _
           "Please install Node.js from https://nodejs.org/" & vbCrLf & _
           "or install via winget: winget install OpenJS.NodeJS", vbCritical, "Node.js Required"
    WScript.Quit 1
End If

' Launch server silently (0 = hidden window, False = do not wait)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run nodeExe & " server.js", 0, False
