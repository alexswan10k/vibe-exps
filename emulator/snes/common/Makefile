ifeq ($(strip $(PVSNESLIB_HOME)),)
$(error "Please create an environment variable PVSNESLIB_HOME with path to its folder")
endif

include ${PVSNESLIB_HOME}/devkitsnes/snes_rules

.PHONY: bitmaps all clean

# ROMNAME is used in snes_rules file
export ROMNAME := game

all: bitmaps $(ROMNAME).sfc
	@mkdir -p ../build
	@mv game.sfc ../build/game.sfc

clean: cleanBuildRes cleanRom cleanGfx
	@rm -f ../build/game.sfc
	
#---------------------------------------------------------------------------------
pvsneslibfont.pic: pvsneslibfont.bmp
	@echo convert font with no tile reduction ... $(notdir $@)
	$(GFXCONV) -n -gs8 -po2 -pc16 -pe1 -mR! -m! -p! $<

bitmaps : pvsneslibfont.pic
