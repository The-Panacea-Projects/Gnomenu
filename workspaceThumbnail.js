/* ========================================================================================================
 * workspaceThumbnail.js - thumbnailsbox object
 * --------------------------------------------------------------------------------------------------------
 *  CREDITS:  Part of this code was copied from the gnome-shell-extensions framework
 *  http://git.gnome.org/browse/gnome-shell-extensions/
  * ========================================================================================================
 */

const _DEBUG_ = false;

const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Signals = imports.signals;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const Main = imports.ui.main;
//const Dash = imports.ui.dash;
const WorkspacesView = imports.ui.workspacesView;
const Workspace = imports.ui.workspace;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Overview = imports.ui.overview;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

// The maximum size of a thumbnail is 1/8 the width and height of the screen
let MAX_THUMBNAIL_SCALE = 1/6.;
let INIT_THUMBNAIL_WIDTH = 200;

// When we create workspaces by dragging, we add a "cut" into the top and
// bottom of each workspace so that the user doesn't have to hit the
// placeholder exactly.
const WORKSPACE_CUT_SIZE = 10;

const WORKSPACE_KEEP_ALIVE_TIME = 100;

const OVERRIDE_SCHEMA = 'org.gnome.shell.overrides';

const ThumbnailState = {
    NEW: 0,
    ANIMATING_IN: 1,
    NORMAL: 2,
    REMOVING: 3,
    ANIMATING_OUT: 4,
    ANIMATED_OUT: 5,
    COLLAPSING: 6,
    DESTROYED: 7
};

const myWindowClone = new Lang.Class({
    Name: 'GnoMenu.myWindowClone',
    Extends: WorkspaceThumbnail.WindowClone,

    _init : function(realWindow) {
        this.parent(realWindow);
    },

    _onButtonRelease : function (actor, event) {
        let button = event.get_button();
        if (button == 3) { //right click
            return false;
        }

        this.emit('selected', event.get_time());
        return Clutter.EVENT_STOP;
    }
});

const myWorkspaceThumbnail = new Lang.Class({
    Name: 'GnoMenu.myWorkspaceThumbnail',
    Extends: WorkspaceThumbnail.WorkspaceThumbnail,

    _init : function(metaWorkspace, gsVersion) {
        if (_DEBUG_) global.log("myWorkspaceThumbnail: init");
        this._gsCurrentVersion = gsVersion;
        this.parent(metaWorkspace);
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    _addWindowClone : function(win) {
        let clone = new myWindowClone(win);

        clone.connect('selected',
                      Lang.bind(this, function(clone, time) {
                          this.activate(time);
                      }));
        clone.connect('drag-begin',
                      Lang.bind(this, function() {
                          Main.overview.beginWindowDrag(clone.metaWindow);
                      }));
        clone.connect('drag-cancelled',
                      Lang.bind(this, function() {
                          Main.overview.cancelledWindowDrag(clone.metaWindow);
                      }));
        clone.connect('drag-end',
                      Lang.bind(this, function() {
                          Main.overview.endWindowDrag(clone.metaWindow);
                      }));
        this._contents.add_actor(clone.actor);

        if (this._windows.length == 0) {
            clone.setStackAbove(this._bgManager.backgroundActor);
        } else {
            clone.setStackAbove(this._windows[this._windows.length - 1].actor);
        }

        this._windows.push(clone);

        return clone;
    }
});

const myThumbnailsBox = new Lang.Class({
    Name: 'GnoMenu.myThumbnailsBox',
    Extends: WorkspaceThumbnail.ThumbnailsBox,

    _init: function(gsVersion, settings, filler) {
        if (_DEBUG_) global.log("myThumbnailsBox: init");
        this._gsCurrentVersion = gsVersion;
        this._mySettings = settings;
        this._thumbnailsBoxFiller = filler;
        this._actualThumbnailWidth = 0;

        // override _init to remove create/destroy thumbnails when showing/hiding overview
        this.actor = new Shell.GenericContainer({ reactive: true,
                                                  style_class: 'gnomenu-workspace-thumbnails',
                                                  request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor._delegate = this;

        this.actor.add_style_class_name('gnomenu-workspaces-background');

        let indicator = new St.Bin({ style_class: 'workspace-thumbnail-indicator' });

        // We don't want the indicator to affect drag-and-drop
        Shell.util_set_hidden_from_pick(indicator, true);

        this._indicator = indicator;
        this.actor.add_actor(indicator);

        this._dropWorkspace = -1;
        this._dropPlaceholderPos = -1;
        this._dropPlaceholder = new St.Bin({ style_class: 'placeholder' });
        this.actor.add_actor(this._dropPlaceholder);
        this._spliceIndex = -1;

        this._targetScale = 0;
        this._scale = 0;
        this._pendingScaleUpdate = false;
        this._stateUpdateQueued = false;
        this._animatingIndicator = false;
        this._indicatorY = 0; // only used when _animatingIndicator is true

        this._stateCounts = {};
        for (let key in ThumbnailState)
            this._stateCounts[ThumbnailState[key]] = 0;

        this._thumbnails = [];

        this.actor.connect('button-press-event', function() { return Clutter.EVENT_STOP; });
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        //Main.overview.connect('showing',
        //                      Lang.bind(this, this._createThumbnails));
        //Main.overview.connect('hidden',
        //                      Lang.bind(this, this._destroyThumbnails));

        Main.overview.connect('item-drag-begin',
                              Lang.bind(this, this._onDragBegin));
        Main.overview.connect('item-drag-end',
                              Lang.bind(this, this._onDragEnd));
        Main.overview.connect('item-drag-cancelled',
                              Lang.bind(this, this._onDragCancelled));
        Main.overview.connect('window-drag-begin',
                              Lang.bind(this, this._onDragBegin));
        Main.overview.connect('window-drag-end',
                              Lang.bind(this, this._onDragEnd));
        Main.overview.connect('window-drag-cancelled',
                              Lang.bind(this, this._onDragCancelled));

        this._settings = new Gio.Settings({ schema: OVERRIDE_SCHEMA });
        this._settings.connect('changed::dynamic-workspaces',
            Lang.bind(this, this._updateSwitcherVisibility));

    },

    // override _createThumbnails to remove global n-workspaces notification
    _createThumbnails: function() {
        if (_DEBUG_) global.log("mythumbnailsBox: _createThumbnails");
        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));
        this._nWorkspacesNotifyId =
            global.screen.connect('notify::n-workspaces',
                                  Lang.bind(this, this._workspacesChanged));
        this._syncStackingId =
            Main.overview.connect('windows-restacked',
                                  Lang.bind(this, this._syncStacking));

        this._targetScale = 0;
        this._scale = 0;
        this._pendingScaleUpdate = false;
        this._stateUpdateQueued = false;

        this._stateCounts = {};
        for (let key in ThumbnailState)
            this._stateCounts[ThumbnailState[key]] = 0;

        this.addThumbnails(0, global.screen.n_workspaces);

        this._updateSwitcherVisibility();
    },

    _destroyThumbnails: function() {
        if (this._switchWorkspaceNotifyId > 0) {
            global.window_manager.disconnect(this._switchWorkspaceNotifyId);
            this._switchWorkspaceNotifyId = 0;
        }
        if (this._nWorkspacesNotifyId > 0) {
            global.screen.disconnect(this._nWorkspacesNotifyId);
            this._nWorkspacesNotifyId = 0;
        }

        if (this._syncStackingId > 0) {
            Main.overview.disconnect(this._syncStackingId);
            this._syncStackingId = 0;
        }

        for (let w = 0; w < this._thumbnails.length; w++)
            this._thumbnails[w].destroy();
        this._thumbnails = [];
        this._porthole = null;
    },

    addThumbnails: function(start, count) {
        this._ensurePorthole();
        for (let k = start; k < start + count; k++) {
            let metaWorkspace = global.screen.get_workspace_by_index(k);
            let thumbnail = new myWorkspaceThumbnail(metaWorkspace, this._gsCurrentVersion);
            thumbnail.setPorthole(this._porthole.x, this._porthole.y,
                                  this._porthole.width, this._porthole.height);
            this._thumbnails.push(thumbnail);
            this.actor.add_actor(thumbnail.actor);

            if (start > 0 && this._spliceIndex == -1) {
                // not the initial fill, and not splicing via DND
                thumbnail.state = ThumbnailState.NEW;
                thumbnail.slidePosition = 1; // start slid out
                this._haveNewThumbnails = true;
            } else {
                thumbnail.state = ThumbnailState.NORMAL;
            }

            this._stateCounts[thumbnail.state]++;
        }

        this._queueUpdateStates();

        // The thumbnails indicator actually needs to be on top of the thumbnails
        this._indicator.raise_top();

        // Clear the splice index, we got the message
        this._spliceIndex = -1;
    },

    // override _onButtonRelease to provide customized click actions (i.e. overview on right click)
    _onButtonRelease: function(actor, event) {
        if (_DEBUG_) global.log("mythumbnailsBox: _onButtonRelease");
        let button = event.get_button();
        if (button == 3) { //right click
            // pass right-click event on allowing it to bubble up
            return Clutter.EVENT_PROPAGATE;
        }


        let [stageX, stageY] = event.get_coords();
        let [r, x, y] = this.actor.transform_stage_point(stageX, stageY);

        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i]
            let [w, h] = thumbnail.actor.get_transformed_size();
            if (y >= thumbnail.actor.y && y <= thumbnail.actor.y + h) {
                //thumbnail.activate(event.time);
                thumbnail.activate(event.get_time());
                break;
            }
        }
        return Clutter.EVENT_STOP;

    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        this._ensurePorthole();

        let themeNode = this.actor.get_theme_node();

        if (this._thumbnails.length == 0)
            return;

        if (_DEBUG_) global.log("myThumbnailsBox: _getPreferredWidth - actualThumbnailWidth = "+this._actualThumbnailWidth);
        let scale;
        if (this._actualThumbnailWidth > 0) {
            scale = this._actualThumbnailWidth / this._porthole.width;
        } else {
            scale = INIT_THUMBNAIL_WIDTH / this._porthole.width;
        }
        if (_DEBUG_) global.log ("myThumbnailsBox: _getPreferredWidth - scale is min of thumbnailWidth scale = "+scale+" vs MAX_THUMBNAIL_SCALE = "+MAX_THUMBNAIL_SCALE);
        scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

        let width = Math.round(this._porthole.width * scale);
        alloc.min_size = width;
        alloc.natural_size = width;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        // Note that for getPreferredWidth/Height we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.

        this._ensurePorthole();
        let themeNode = this.actor.get_theme_node();

        if (this._thumbnails.length == 0)
            return;

        let spacing = themeNode.get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        if (_DEBUG_) global.log("myThumbnailsBox: _getPreferredHeight - actualThumbnailWidth = "+this._actualThumbnailWidth);
        let scale;
        if (this._actualThumbnailWidth > 0) {
            scale = this._actualThumbnailWidth / this._porthole.width;
        } else {
            scale = INIT_THUMBNAIL_WIDTH / this._porthole.width;
        }
        if (_DEBUG_) global.log ("myThumbnailsBox: _getPreferredHeight - scale is min of thumbnailWidth scale = "+scale+" vs MAX_THUMBNAIL_SCALE = "+MAX_THUMBNAIL_SCALE);
        scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

        alloc.min_size = totalSpacing;
        alloc.natural_size = totalSpacing + nWorkspaces * this._porthole.height * scale;
    },

    _allocate: function(actor, box, flags) {
        let rtl = (Clutter.get_default_text_direction () == Clutter.TextDirection.RTL);

        if (this._thumbnails.length == 0) // not visible
            return;

        let themeNode = this.actor.get_theme_node();

        this._actualThumbnailWidth = box.x2 - box.x1;

        let portholeWidth = this._porthole.width;
        let portholeHeight = this._porthole.height;
        let spacing = themeNode.get_length('spacing');

        // Compute the scale we'll need once everything is updated
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;
        let avail = (box.y2 - box.y1) - totalSpacing;
        
        let newScale = (box.x2 - box.x1) / portholeWidth;
        newScale = Math.min(newScale, MAX_THUMBNAIL_SCALE);

        if (newScale != this._targetScale) {
            if (this._targetScale > 0) {
                // We don't do the tween immediately because we need to observe the ordering
                // in queueUpdateStates - if workspaces have been removed we need to slide them
                // out as the first thing.
                this._targetScale = newScale;
                this._pendingScaleUpdate = true;
            } else {
                this._targetScale = this._scale = newScale;
            }

            this._queueUpdateStates();
        }

        let thumbnailHeight = portholeHeight * this._scale;
        let thumbnailWidth = Math.round(portholeWidth * this._scale);
        let roundedHScale = thumbnailWidth / portholeWidth;

        let slideOffset; // X offset when thumbnail is fully slid offscreen
        if (rtl)
            slideOffset = - (thumbnailWidth + themeNode.get_padding(St.Side.LEFT));
        else
            slideOffset = thumbnailWidth + themeNode.get_padding(St.Side.RIGHT);

        let indicatorY1 = this._indicatorY;
        let indicatorY2;
        // when not animating, the workspace position overrides this._indicatorY
        let indicatorWorkspace = !this._animatingIndicator ? global.screen.get_active_workspace() : null;
        let indicatorThemeNode = this._indicator.get_theme_node();

        let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
        let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

        let y = box.y1;

        if (this._dropPlaceholderPos == -1) {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function() {
                this._dropPlaceholder.hide();
            }));
        }

        let childBox = new Clutter.ActorBox();
        
        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];

            if (i > 0)
                y += spacing - Math.round(thumbnail.collapseFraction * spacing);

            let x1, x2;
            if (rtl) {
                x1 = box.x1 + slideOffset * thumbnail.slidePosition;
                x2 = x1 + thumbnailWidth;
            } else {
                x1 = box.x2 - thumbnailWidth + slideOffset * thumbnail.slidePosition;
                x2 = x1 + thumbnailWidth;
            }

            if (i == this._dropPlaceholderPos) {
                let [minHeight, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
                childBox.x1 = x1;
                childBox.x2 = x1 + thumbnailWidth;
                childBox.y1 = Math.round(y);
                childBox.y2 = Math.round(y + placeholderHeight);
                this._dropPlaceholder.allocate(childBox, flags);
                Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function() {
                    this._dropPlaceholder.show();
                }));
                y += placeholderHeight + spacing;
            }

            // We might end up with thumbnailHeight being something like 99.33
            // pixels. To make this work and not end up with a gap at the bottom,
            // we need some thumbnails to be 99 pixels and some 100 pixels height;
            // we compute an actual scale separately for each thumbnail.
            let y1 = Math.round(y);
            let y2 = Math.round(y + thumbnailHeight);
            let roundedVScale = (y2 - y1) / portholeHeight;

            if (thumbnail.metaWorkspace == indicatorWorkspace) {
                indicatorY1 = y1;
                indicatorY2 = y2;
            }

            // Allocating a scaled actor is funny - x1/y1 correspond to the origin
            // of the actor, but x2/y2 are increased by the *unscaled* size.
            childBox.x1 = x1;
            childBox.x2 = x1 + portholeWidth;
            childBox.y1 = y1;
            childBox.y2 = y1 + portholeHeight;

            thumbnail.actor.set_scale(roundedHScale, roundedVScale);
            thumbnail.actor.allocate(childBox, flags);

            // We round the collapsing portion so that we don't get thumbnails resizing
            // during an animation due to differences in rounded, but leave the uncollapsed
            // portion unrounded so that non-animating we end up with the right total
            y += thumbnailHeight - Math.round(thumbnailHeight * thumbnail.collapseFraction);
        }

        if (rtl) {
            childBox.x1 = box.x1;
            childBox.x2 = box.x1 + thumbnailWidth;
        } else {
            childBox.x1 = box.x2 - thumbnailWidth;
            childBox.x2 = box.x2;
        }
        childBox.x1 -= indicatorLeftFullBorder;
        childBox.x2 += indicatorRightFullBorder;
        childBox.y1 = indicatorY1 - indicatorTopFullBorder;
        childBox.y2 = (indicatorY2 ? indicatorY2 : (indicatorY1 + thumbnailHeight)) + indicatorBottomFullBorder;
        this._indicator.allocate(childBox, flags);
    },

    // override _activeWorkspaceChanged to eliminate errors thrown
    _activeWorkspaceChanged: function(wm, from, to, direction) {
        if (_DEBUG_) global.log("mythumbnailsBox: _activeWorkspaceChanged - thumbnail count = "+this._thumbnails.length);
        let thumbnail;
        let activeWorkspace = global.screen.get_active_workspace();
        for (let i = 0; i < this._thumbnails.length; i++) {
            if (this._thumbnails[i].metaWorkspace == activeWorkspace) {
                thumbnail = this._thumbnails[i];
                break;
            }
        }

        // passingthru67 - needed in case thumbnail is null outside of overview
        if (thumbnail == null)
            return

        // passingthru67 - needed in case thumbnail.actor is null outside of overview
        if (thumbnail.actor == null)
            return

        this._animatingIndicator = true;
        let indicatorThemeNode = this._indicator.get_theme_node();
        let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        this.indicatorY = this._indicator.allocation.y1 + indicatorTopFullBorder;

        Tweener.addTween(this,
                         { indicatorY: thumbnail.actor.allocation.y1,
                           time: WorkspacesView.WORKSPACE_SWITCH_TIME,
                           transition: 'easeOutQuad',
                           onComplete: function() {
                               this._animatingIndicator = false;
                               this._queueUpdateStates();
                           },
                           onCompleteScope: this
                         });
    }
});
