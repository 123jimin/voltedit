let L10N_STRING = `

not-yet-implemented
	en: Not yet implemented.
	ko: 아직 구현되지 않은 기능입니다.

### Toolbar ###

tab-home
	en: Home
	ko: 홈
tab-chart
	en: Chart
	ko: 채보
tab-notes-and-lasers
	en: Notes & Lasers
	ko: 노트 및 레이저
tab-timing
	en: Timing
	ko: 타이밍
tab-camera
	en: Camera
	ko: 카메라
tab-options
	en: Options
	ko: 설정

tab-panel-file
	en: File
	ko: 파일
tab-panel-edit
	en: Edit
	ko: 편집
tab-panel-display
	en: Display
	ko: 표시
tab-panel-basic-info
	en: Basic Information
	ko: 기본 정보
tab-panel-difficulty
	en: Difficulty
	ko: 난이도
tab-panel-music
	en: Music
	ko: 음악
tab-panel-jacket
	en: Jacket
	ko: 자켓 이미지
tab-panel-misc
	en: Miscellaneous
	ko: 기타
tab-panel-chart-display-details
	en: Chart Display Details
	ko: 채보 표시 세부 사항
tab-panel-chart-display-color
	en: Chart Display Color
	ko: 채보 표시 색
tab-panel-language
	en: Language
	ko: 언어(Language)

toolbar-default
	en: Default:
	ko: 기본 값:

toolbar-new-file
	en: New
	ko: 새로
toolbar-new-file-desc
	en: Create a new chart.
	ko: 새 채보를 만듭니다.
toolbar-open-file
	en: Open
	ko: 열기
toolbar-open-file-desc
	en: Choose a chart file to be edited.
	ko: 편집할 채보 파일을 선택합니다.
toolbar-save-kson
	en: KSON
	ko: KSON
toolbar-save-kson-desc
	en: Save as a KSON format. (k-shoot 2)
	ko: KSON 포맷으로 저장합니다. (케슛 2)
toolbar-save-ksh
	en: KSH
	ko: KSH
toolbar-save-ksh-desc
	en: Save as a KSH format. (k-shoot 1.xx)
	ko: KSH 포맷으로 저장합니다. (케슛 1.xx)

toolbar-decrease-edit-tick
	en: Decrease edit tick beat
	ko: 편집 단위박 감소
toolbar-increase-edit-tick
	en: Increase edit tick beat
	ko: 편집 단위박 증가

toolbar-toggle-insert
	en: Toggle between select/edit mode
	ko: 선택/편집 모드간 변환

toolbar-context-chart
	en: Edit chart BPM/beat
	ko: 채보 BPM/박자 편집
toolbar-context-bt
	en: Edit BT notes
	ko: BT 노트 편집
toolbar-context-fx
	en: Edit FX notes
	ko: FX 노트 편집
toolbar-context-laser-left
	en: Edit left laser
	ko: 왼쪽 레이저 편집
toolbar-context-laser-right
	en: Edit right laser
	ko: 오른쪽 레이저 편집

toolbar-note-width
	en: Note width:
	ko: 노트 너비:
toolbar-measure-scale
	en: Vertical scale:
	ko: 세로 확대:
toolbar-columns
	en: Columns:
	ko: 행 수:

toolbar-song-title
	en: Title:
	ko: 제목:
toolbar-song-subtitle
	en: Subtitle/Genre:
	ko: 부제목/장르:
toolbar-difficulty
	en: Difficulty:
	ko: 난이도:
toolbar-artist
	en: Song by:
	ko: 작곡가:
toolbar-charter
	en: Charted by:
	ko: 채보 제작자:
toolbar-jacket-author
	en: Jacket by:
	ko: 자켓 제작자:

toolbar-difficulty-name
	en: Custom name:
	ko: 커스텀 이름:
toolbar-difficulty-short-name
	en: Custom abbr.:
	ko: 커스텀 축약어:
toolbar-gauge-total
	en: Gauge total:
	ko: 게이지 토탈값:

toolbar-path
	en: Path:
	ko: 경로:

toolbar-margin-side
	en: Side margin:
	ko: 좌우 여백:
toolbar-margin-bottom
	en: Bottom margin:
	ko: 아래 여백:

### Operations ###

operation-invalid
	en: Operation %1 is not valid.
	ko: 작업 %1은 유효한 작업이 아닙니다.

### Tasks ###

task-add-bt
	en: adding a BT note
	ko: BT 노트 추가
task-add-fx
	en: adding an FX note
	ko: FX 노트 추가
task-add-graph-point
	en: adding a graph point
	ko: 그래프 점 추가
task-add-laser-point
	en: adding a laser point
	ko: 레이저 점 추가
task-move-selection
	en: moving selection
	ko: 선택 영역 이동
task-resize-selected
	en: resizing selected
	ko: 선택 요소 크기 변경
task-delete-selected
	en: deleting selected
	ko: 선택 요소 삭제

task-commit-error
	en: Committing "%1" failed!
	ko: %1 작업에 실패했습니다.
task-undo
	en: Undid "%1"
	ko: %1 되돌리기
task-undo-error
	en: Failed to undo "%1"
	ko: %1 되돌리기 실패
task-undo-invalid
	en: Can't make an inverse of a task with invalid state.
	ko: 유효하지 않은 상태의 작업의 반대 작업을 만들 수 없습니다.
task-redo
	en: Redid "%1"
	ko: %1 다시하기
task-redo-error
	en: Failed to redo "%1"
	ko: %1 다시하기 실패
task-warn-clear-history
	en: Clearing history due to an undoable task "%1"
	ko: 되돌리기 불가능한 %1 작업으로 인해 작업 내역이 삭제되었습니다.

task-collection-commit-disposed-error
	en: Committing a collection of tasks failed because it was already disposed.
	ko: 여러 작업을 한 번에 실행하는 중 오류가 발생했습니다! (유효하지 않은 모임)
task-collection-commit-revert-error
	en: Revert failed while tryping to commit multiple tasks at once!
	ko: 여러 작업을 한 번에 되돌리는 중 오류가 발생했습니다!

### Chart I/O ###

k-shoot-mania-chart-file
	en: k-shoot mania chart file
	ko: 케슛매니아 채보 파일
usc-binary-chart-file
	en: USC binary chart file
	ko: USC 바이너리 채보 파일
file-saved-as
	en: File saved as %1
	ko: 파일 %1 저장 성공

drop-file-here
	en: Drop to Open File
	ko: 끌어다 놓아서 파일 열기

error-reading-chart-data
	en: Failed to read the chart data!
	ko: 채보 데이터를 읽을 수 없습니다!

ksh-import-warn-no-trailing-dashes
	en: Processing a KSH file with no '--' at the end...
	ko: 끝에 '--'가 지정되지 않은 KSH 파일을 처리하는 중...
ksh-import-error-invalid-header
	en: Invalid KSH header
	ko: 올바르지 않은 KSH 헤더
ksh-import-error-value
	en: Invalid KSH %1 value (idx=%2)
	ko: 올바르지 않은 KSH %1값 (idx=%2)
ksh-import-error-malformed-measure
	en: Malformed KSH measure (idx=%1)
	ko: 올바르지 않은 KSH 마디 (idx=%1)
ksh-import-error-invalid-measure-line-count
	en: Invalid KSH measure line count (idx=%1)
	ko: 올바르지 않은 KSH 마디 줄 수 (idx=%1)
ksh-import-error-invalid-time-sig-location
	en: KSH time signature at invalid location (idx=%1)
	ko: 올바르지 않은 변박 지정 위치 (idx=%1)
ksh-import-error-invalid-laser-pos
	en: Invalid KSH laser position
	ko: 올바르지 않은 KSH 레이저 위치
ksh-export-error-resolution
	en: Exporting to KSH is not supported when the chart resolution is not %1.
	ko: Resolution값이 %1이 아닌 채보는 KSH로 내보낼 수 없습니다.
ksh-export-warn-omitted
	en: This chart contains %1, which can't be represented in KSH.
	ko: 이 채보는 KSH로 내보낼 수 없는 %1 요소를 포함하고 있습니다.

`;
