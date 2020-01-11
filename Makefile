# Makefile for VOLTEdit
# Yes, this Makefile and all JS sources are intended to be accessible online.
# The whole code's on GitHub anyway...

# Can't use wildcards as they need to be ordered.
# I'm not using modules for now.
SRC_UTIL = shim.js aa-tree.js misc.js l10n.js settings.js
SRC_DATA = chart.js ksh.js kson.js
SRC_VIEW = settings.js render-components.js render.js view-components.js view.js
SRC_EDIT = key-manager.js task-manager.js tasks.js
SRC_EDITOR = toolbar.js editor.js

SRC_FILES = $(addprefix js/util/, $(SRC_UTIL)) \
			$(addprefix js/data/, $(SRC_DATA)) \
			$(addprefix js/view/, $(SRC_VIEW)) \
			$(addprefix js/edit/, $(SRC_EDIT)) \
			$(addprefix js/, $(SRC_EDITOR))

TARGET = js/voltedit.min.js

COMPRESSOR = uglifyjs
COMPRESSOR_OPTIONS = --compress --warn --timings

all: $(TARGET)
clean:
	rm $(TARGET)

$(TARGET): $(SRC_FILES)
	$(COMPRESSOR) $(SRC_FILES) $(COMPRESSOR_OPTIONS) --source-map --output $(TARGET)
