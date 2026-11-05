; Custom wording for the BranchFlow installer wizard.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to BranchFlow"
  !define MUI_WELCOMEPAGE_TEXT "Keep every client branch in sync with main, visually.$\r$\n$\r$\nDraw how code should flow, check for conflicts before anything changes, run every merge in the right order and publish or undo it with one click.$\r$\n$\r$\nBranchFlow uses the Git already installed on this PC and your existing Git credentials and SSH keys. Git 2.38 or newer is required.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend
