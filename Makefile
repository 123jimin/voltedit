# Makefile for VOLTEdit
# Yes, this Makefile and all JS sources are intended to be accessible online.
# The whole code's on GitHub anyway...

# Can't use wildcards as they need to be ordered.
# I'm not using modules for now.
SRC_UTIL := shim.js aa-tree.js misc.js logger.js l10n.js settings.js
SRC_DATA := common.js graph.js chart.js ksh.js ksh-exporter.js kson.js
SRC_VIEW := settings.js render-components.js render.js view-components.js view.js
SRC_MANAGER := key-manager.js task-manager.js file-manager.js
SRC_EDIT := task.js object.js context.js
SRC_UI := toolbar.js message.js
SRC_EDITOR := editor.js

SRC_FILES := $(addprefix js/util/, ${SRC_UTIL}) \
			$(addprefix js/data/, ${SRC_DATA}) \
			$(addprefix js/view/, ${SRC_VIEW}) \
			$(addprefix js/manager/, ${SRC_MANAGER}) \
			$(addprefix js/edit/, ${SRC_EDIT}) \
			$(addprefix js/ui/, ${SRC_UI}) \
			$(addprefix js/, ${SRC_EDITOR})

JS_TARGET := js/voltedit.min.js
JS_TARGET_MAP := $(JS_TARGET).map

JS_COMPRESSOR := uglifyjs
JS_COMPRESSOR_SOURCE_MAP_OPTIONS = "filename='$(JS_TARGET_MAP)',url='$(notdir ${JS_TARGET_MAP})',root='..'"
JS_COMPRESSOR_OPTIONS := --compress --warn --source-map $(JS_COMPRESSOR_SOURCE_MAP_OPTIONS)

CSS_SOURCE := css/main.less
CSS_TARGET := css/main.css
CSS_TARGET_MAP := $(CSS_TARGET).map

LESSC := lessc
LESS_CLEAN_OPTIONS := --rounding-precision=-1
LESSC_OPTIONS := --source-map=$(CSS_TARGET_MAP) --clean-css="$(LESS_CLEAN_OPTIONS)"

# From https://eugene-babichenko.github.io/blog/2019/09/28/nightly-versions-makefiles/
# Shows GIT version
GIT_TAG_COMMIT := $(shell git rev-list --abbrev-commit --tags --max-count=1)
GIT_TAG := $(shell git describe --abbrev=0 --tags ${GIT_TAG_COMMIT} 2>/dev/null || true)
GIT_COMMIT := $(shell git rev-parse --short HEAD)
# GIT_DATE := $(shell git log -1 --format=%cd --date=format:"%Y%m%d")
VERSION := $(GIT_TAG)
VERSION_REV := $(shell git rev-list --count HEAD)
VERSION_DIRTY := false
ifneq ($(GIT_COMMIT), $(GIT_TAG_COMMIT))
    VERSION := $(VERSION)-$(GIT_COMMIT)
endif
ifeq ($(VERSION),)
    VERSION := c$(GIT_COMMIT)
endif
ifneq ($(shell git status --porcelain),)
    VERSION := $(VERSION)-dirty
	VERSION_DIRTY := true
endif

# To show versions even when the loading is failed, version is stored in a separate file.
VERSION_TARGET := js/voltedit.version.js

all: $(JS_TARGET) $(CSS_TARGET) $(VERSION_TARGET)

clean:
	@rm --force --verbose $(JS_TARGET) $(JS_TARGET_MAP) $(CSS_TARGET) $(CSS_TARGET_MAP) $(VERSION_TARGET)

$(JS_TARGET): $(SRC_FILES)
	@rm --force --verbose $(VERSION_TARGET)
	@echo "Building JS to $(JS_TARGET)..."
	@$(JS_COMPRESSOR) $(SRC_FILES) $(JS_COMPRESSOR_OPTIONS) --output $(JS_TARGET)

$(CSS_TARGET): $(wildcard css/*.less)
	@rm --force --verbose $(VERSION_TARGET)
	@echo "Building CSS to $(CSS_TARGET)..."
	@$(LESSC) $(LESSC_OPTIONS) $(CSS_SOURCE) $(CSS_TARGET)

$(VERSION_TARGET):
	@echo "Generating version info for $(VERSION) (r$(VERSION_REV))..."
	@echo "var VOLTEDIT_VERSION={str:\"$(VERSION)\",rev:$(VERSION_REV),dirty:$(VERSION_DIRTY)};" > $(VERSION_TARGET)
