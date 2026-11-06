' Pinpoint launcher - starts the stack with no console window.
Dim shell, fso, root
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
shell.CurrentDirectory = root
shell.Run "node """ & root & "\scripts\launcher.mjs"" start", 0, False
