/* ========================================================================================================
 * myThumbnailsBox.js - thumbnailsbox object
 * --------------------------------------------------------------------------------------------------------
 *  CREDITS:  Part of this code was copied from the gnome-shell-extensions framework
 *  http://git.gnome.org/browse/gnome-shell-extensions/
  * ========================================================================================================
 */

const _DEBUG_ = true;

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
let MAX_THUMBNAIL_SCALE = 1/8.;
let MAX_THUMBNAIL_WIDTH = 200;

//const RESCALE_ANIMATION_TIME = 0.2;
//const SLIDE_ANIMATION_TIME = 0.2;

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

const myWorkspaceThumbnail = new Lang.Class({
    Name: 'GnoMenu.myWorkspaceThumbnail',
    Extends: WorkspaceThumbnail.WorkspaceThumbnail,
    
    _init : function(metaWorkspace) {
        this.parent(metaWorkspace);
    },

    // Draggable target interface used only by ThumbnailsBox
    handleDragOverInternal : function(source, time) {
        if (_DEBUG_) global.log("myWorkspaceThumbnail: handleDragOverInternal");
        if (source == Main.xdndHandler) {
            this.metaWorkspace.activate(time);
            return DND.DragMotionResult.CONTINUE;
        }

        if (this.state > ThumbnailState.NORMAL)
            return DND.DragMotionResult.CONTINUE;

        if (source.realWindow && !this._isMyWindow(source.realWindow))
            return DND.DragMotionResult.MOVE_DROP;
        if (source.shellWorkspaceLaunch)
            return DND.DragMotionResult.COPY_DROP;

        return DND.DragMotionResult.CONTINUE;
    },

    acceptDropInternal : function(source, time) {
        if (_DEBUG_) global.log("myWorkspaceThumbnail: acceptDropInternal");
        if (this.state > ThumbnailState.NORMAL)
            return false;

        if (source.realWindow) {
            let win = source.realWindow;
            if (this._isMyWindow(win))
                return false;

            let metaWindow = win.get_meta_window();

            // We need to move the window before changing the workspace, because
            // the move itself could cause a workspace change if the window enters
            // the primary monitor
            if (metaWindow.get_monitor() != this.monitorIndex)
                metaWindow.move_to_monitor(this.monitorIndex);

            metaWindow.change_workspace_by_index(this.metaWorkspace.index(),
                                                 false, // don't create workspace
                                                 time);
            return true;
        } else if (source.shellWorkspaceLaunch) {
            source.shellWorkspaceLaunch({ workspace: this.metaWorkspace ? this.metaWorkspace.index() : -1,
                                          timestamp: time });
            return true;
        }

        return false;
    }
});

const myThumbnailsBox = new Lang.Class({
    Name: 'GnoMenu.myThumbnailsBox',
    Extends: WorkspaceThumbnail.ThumbnailsBox,

    _init: function(gsVersion, settings) {
        if (_DEBUG_) global.log("myThumbnailsBox: init");
        this._actualThumbnailWidth = 0;
        this._gsCurrentVersion = gsVersion;
        this._mySettings = settings;
        if (this._gsCurrentVersion[1] < 7) {
            this.parent();
        } else {
            // override GS38 _init to remove create/destroy thumbnails when showing/hiding overview
            this.actor = new Shell.GenericContainer({ reactive: true,
                                                      style_class: 'workspace-thumbnails',
                                                      request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
            this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
            this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
            this.actor.connect('allocate', Lang.bind(this, this._allocate));
            this.actor._delegate = this;

            // When we animate the scale, we don't animate the requested size of the thumbnails, rather
            // we ask for our final size and then animate within that size. This slightly simplifies the
            // interaction with the main workspace windows (instead of constantly reallocating them
            // to a new size, they get a new size once, then use the standard window animation code
            // allocate the windows to their new positions), however it causes problems for drawing
            // the background and border wrapped around the thumbnail as we animate - we can't just pack
            // the container into a box and set style properties on the box since that box would wrap
            // around the final size not the animating size. So instead we fake the background with
            // an actor underneath the content and adjust the allocation of our children to leave space
            // for the border and padding of the background actor.
            this._background = new St.Bin({ style_class: 'gnomenu-thumbnails-background' });

            this.actor.add_actor(this._background);

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

            this.actor.connect('button-press-event', function() { return true; });
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
        }
    },

    // Override GS38 handleDragOver to include menu grid/list items
    handleDragOver : function(source, actor, x, y, time) {
        if(_DEBUG_) global.log("myThumbnailsBox: handleDragOver");
        if (!source.realWindow && !source.shellWorkspaceLaunch && source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        let canCreateWorkspaces = Meta.prefs_get_dynamic_workspaces();
        let spacing = this.actor.get_theme_node().get_length('spacing');

        this._dropWorkspace = -1;
        let placeholderPos = -1;
        let targetBase;
        if (this._dropPlaceholderPos == 0)
            targetBase = this._dropPlaceholder.y;
        else
            targetBase = this._thumbnails[0].actor.y;
        let targetTop = targetBase - spacing - WORKSPACE_CUT_SIZE;
        let length = this._thumbnails.length;
        for (let i = 0; i < length; i ++) {
            // Allow the reorder target to have a 10px "cut" into
            // each side of the thumbnail, to make dragging onto the
            // placeholder easier
            let [w, h] = this._thumbnails[i].actor.get_transformed_size();
            let targetBottom = targetBase + WORKSPACE_CUT_SIZE;
            let nextTargetBase = targetBase + h + spacing;
            let nextTargetTop =  nextTargetBase - spacing - ((i == length - 1) ? 0: WORKSPACE_CUT_SIZE);

            // Expand the target to include the placeholder, if it exists.
            if (i == this._dropPlaceholderPos)
                targetBottom += this._dropPlaceholder.get_height();

            if (y > targetTop && y <= targetBottom && source != Main.xdndHandler && canCreateWorkspaces) {
                placeholderPos = i;
                break;
            } else if (y > targetBottom && y <= nextTargetTop) {
                this._dropWorkspace = i;
                break
            }

            targetBase = nextTargetBase;
            targetTop = nextTargetTop;
        }

        if (this._dropPlaceholderPos != placeholderPos) {
            this._dropPlaceholderPos = placeholderPos;
            this.actor.queue_relayout();
        }

        if (this._dropWorkspace != -1)
            return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, time);
        else if (this._dropPlaceholderPos != -1)
            return source.realWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
        else
            return DND.DragMotionResult.CONTINUE;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if(_DEBUG_) global.log("myThumbnailsBox: acceptDrop");
        if (this._dropWorkspace != -1) {
            return this._thumbnails[this._dropWorkspace].acceptDropInternal(source, time);
        } else if (this._dropPlaceholderPos != -1) {
            if (!source.realWindow && !source.shellWorkspaceLaunch)
                return false;

            let isWindow = !!source.realWindow;

            // To create a new workspace, we first slide all the windows on workspaces
            // below us to the next workspace, leaving a blank workspace for us to recycle.
            let newWorkspaceIndex;
            [newWorkspaceIndex, this._dropPlaceholderPos] = [this._dropPlaceholderPos, -1];

            // Nab all the windows below us.
            let windows = global.get_window_actors().filter(function(win) {
                if (isWindow)
                    return win.get_workspace() >= newWorkspaceIndex && win != source;
                else
                    return win.get_workspace() >= newWorkspaceIndex;
            });

            this._spliceIndex = newWorkspaceIndex;

            // ... move them down one.
            windows.forEach(function(win) {
                win.meta_window.change_workspace_by_index(win.get_workspace() + 1,
                                                          true, time);
            });

            if (isWindow)
                // ... and bam, a workspace, good as new.
                source.metaWindow.change_workspace_by_index(newWorkspaceIndex,
                                                            true, time);
            else if (source.shellWorkspaceLaunch) {
                source.shellWorkspaceLaunch({ workspace: newWorkspaceIndex,
                                              timestamp: time });
                // This new workspace will be automatically removed if the application fails
                // to open its first window within some time, as tracked by Shell.WindowTracker.
                // Here, we only add a very brief timeout to avoid the _immediate_ removal of the
                // workspace while we wait for the startup sequence to load.
                Main.keepWorkspaceAlive(global.screen.get_workspace_by_index(newWorkspaceIndex),
                                        WORKSPACE_KEEP_ALIVE_TIME);
            }

            // Start the animation on the workspace (which is actually
            // an old one which just became empty)
            let thumbnail = this._thumbnails[newWorkspaceIndex];
            this._setThumbnailState(thumbnail, ThumbnailState.NEW);
            thumbnail.slidePosition = 1;

            this._queueUpdateStates();

            return true;
        } else {
            return false;
        }
    },

    // override GS38 _createThumbnails to remove global n-workspaces notification
    _createThumbnails: function() {
        if (_DEBUG_) global.log("mythumbnailsBox: _createThumbnails");
        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));
        //this._nWorkspacesNotifyId =
            //global.screen.connect('notify::n-workspaces',
                                  //Lang.bind(this, this._workspacesChanged));
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

        // The "porthole" is the portion of the screen that we show in the workspaces
        this._porthole = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

        this.addThumbnails(0, global.screen.n_workspaces);

        this._updateSwitcherVisibility();
    },

    addThumbnails: function(start, count) {
        for (let k = start; k < start + count; k++) {
            let metaWorkspace = global.screen.get_workspace_by_index(k);
            //let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
            let thumbnail = new myWorkspaceThumbnail(metaWorkspace);
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
//        if (this._mySettings.get_boolean('toggle-overview')) {
//            let button = event.get_button();
//            if (button == 3) { //right click
//                if (Main.overview.visible) {
//                    Main.overview.hide(); // force normal mode
//                } else {
//                    Main.overview.show(); // force overview mode
//                }
//                // pass right-click event on allowing it to bubble up
//                return false;
//            }
//        }

        let button = event.get_button();
        if (button == 3) { //right click
            // pass right-click event on allowing it to bubble up
            return false;
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
        return true;

    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        // See comment about this._background in _init()
        let themeNode = this._background.get_theme_node();

        if (this._thumbnails.length == 0)
            return;

        global.log("preferredWidth - actualThumbnailWidth = "+this._actualThumbnailWidth);
        let scale;
        if (this._actualThumbnailWidth > 0) {
            scale = this._actualThumbnailWidth / this._porthole.width;
        } else {
            scale = MAX_THUMBNAIL_WIDTH / this._porthole.width;
        }
        scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

        let width = Math.round(this._porthole.width * scale);
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_width(width, width);
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        // See comment about this._background in _init()
        let themeNode = this._background.get_theme_node();

        // Note that for getPreferredWidth/Height we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.

        if (this._thumbnails.length == 0)
            return;

        let spacing = this.actor.get_theme_node().get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        global.log("preferredHeight - actualThumbnailWidth = "+this._actualThumbnailWidth);
        let scale;
        if (this._actualThumbnailWidth > 0) {
            scale = this._actualThumbnailWidth / this._porthole.width;
        } else {
            scale = MAX_THUMBNAIL_WIDTH / this._porthole.width;
        }
        scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_height(totalSpacing,
                                              totalSpacing + nWorkspaces * this._porthole.height * scale);
    },

    _allocate: function(actor, box, flags) {
        let rtl = (Clutter.get_default_text_direction () == Clutter.TextDirection.RTL);

        // See comment about this._background in _init()
        let themeNode = this._background.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        global.log("contentBox h ="+(contentBox.y2-contentBox.y1)+" w = "+(contentBox.x2-contentBox.x1));
        this._actualThumbnailWidth = contentBox.x2 - contentBox.x1;
        if (this._thumbnails.length == 0) // not visible
            return;

        let portholeWidth = this._porthole.width;
        let portholeHeight = this._porthole.height;
        let spacing = this.actor.get_theme_node().get_length('spacing');

//        // Compute the scale we'll need once everything is updated
//        let nWorkspaces = global.screen.n_workspaces;
//        let totalSpacing = (nWorkspaces - 1) * spacing;
//        let avail = (contentBox.y2 - contentBox.y1) - totalSpacing;

        let newScale = (contentBox.x2 - contentBox.x1) / portholeWidth;
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

        let childBox = new Clutter.ActorBox();

        // The background is horizontally restricted to correspond to the current thumbnail size
        // but otherwise covers the entire allocation
        if (rtl) {
            childBox.x1 = box.x1;
            childBox.x2 = box.x2 - ((contentBox.x2 - contentBox.x1) - thumbnailWidth);
        } else {
            childBox.x1 = box.x1 + ((contentBox.x2 - contentBox.x1) - thumbnailWidth);
            childBox.x2 = box.x2;
        }
        childBox.y1 = box.y1;
        childBox.y2 = box.y2;
        global.log("childBox height = "+(childBox.y2 - childBox.y1));

        this._background.allocate(childBox, flags);

        let indicatorY1 = this._indicatorY;
        let indicatorY2;
        // when not animating, the workspace position overrides this._indicatorY
        let indicatorWorkspace = !this._animatingIndicator ? global.screen.get_active_workspace() : null;
        let indicatorThemeNode = this._indicator.get_theme_node();

        let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
        let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

        let y = contentBox.y1;

        if (this._dropPlaceholderPos == -1) {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function() {
                this._dropPlaceholder.hide();
            }));
        }

        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];

            if (i > 0)
                y += spacing - Math.round(thumbnail.collapseFraction * spacing);

            let x1, x2;
            if (rtl) {
                x1 = contentBox.x1 + slideOffset * thumbnail.slidePosition;
                x2 = x1 + thumbnailWidth;
            } else {
                x1 = contentBox.x2 - thumbnailWidth + slideOffset * thumbnail.slidePosition;
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
            childBox.x1 = contentBox.x1;
            childBox.x2 = contentBox.x1 + thumbnailWidth;
        } else {
            childBox.x1 = contentBox.x2 - thumbnailWidth;
            childBox.x2 = contentBox.x2;
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

        // passingthru67 - conditional for gnome shell 3.4/3.6/# differences
        if (this._gsCurrentVersion[1] < 6) {
            this._animatingIndicator = true;
            this.indicatorY = this._indicator.allocation.y1;
        } else {
            this._animatingIndicator = true;
            let indicatorThemeNode = this._indicator.get_theme_node();
            let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
            this.indicatorY = this._indicator.allocation.y1 + indicatorTopFullBorder;
        }

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
