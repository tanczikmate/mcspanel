' ==============================================================================
' MCSPanel - Háttérben futó (rejtett / ablakmentes) indító
' ==============================================================================
' Ez a szkript elindítja az MCSPanel Node.js backendjét teljesen rejtve,
' bármiféle felugró terminál vagy parancssori ablak nélkül.
'
' Használat:
' 1. Dupla kattintás a közvetlen háttérben indításhoz.
' 2. Gépindításkor való automatikus induláshoz:
'    - Nyomd meg a Win + R billentyűkombinációt, írd be: shell:startup
'    - Hozz létre egy parancsikont erről a fájlról a megnyíló Indítópult mappában!
' ==============================================================================

Option Explicit

Dim fso, currentDir, distFile, WshShell

Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Ellenőrizzük, hogy a szerver le van-e fordítva
distFile = fso.BuildPath(currentDir, "server\dist\index.js")
If Not fso.FileExists(distFile) Then
    MsgBox "Az MCSPanel szerver még nincs lefordítva!" & vbCrLf & vbCrLf & _
           "Kérlek futtasd a 'start.bat' fájlt legalább egyszer a projekt felépítéséhez.", _
           vbExclamation, "MCSPanel - Hiányzó build"
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = currentDir

' 0 = Rejtett ablak (SW_HIDE), False = Aszinkron futás (a VBScript azonnal lefut, a Node fut tovább a háttérben)
WshShell.Run "node server\dist\index.js", 0, False
