/* ========================================================================================================
 * extension.js - GnoMenu extension
 * --------------------------------------------------------------------------------------------------------
 *  CREDITS:  A large part of this code was copied from the Mint menu and Axe menu extensions. Many thanks
 *  to those developers for their great extensions and laying the foundation for GnoMenu.
 *
 *  some parts of this code also come from:
 *  gnome-shell-extensions -  http://git.gnome.org/browse/gnome-shell-extensions/
 *  places status indicator extension - http://git.gnome.org/gnome-shell-extensions
 *  recent items extension - http://www.bananenfisch.net/gnome
 *  applications menu extension - https://extensions.gnome.org/extension/6/applications-menu/
 *  search bookmarks extension - https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================================================
 */

const _DEBUG_ = false;

const IconTheme = imports.gi.Gtk.IconTheme;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GMenu = imports.gi.GMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
//const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Signals = imports.signals;
const Params = imports.misc.params;
const Config = imports.misc.config;
const GnomeSession = imports.misc.gnomeSession;
const AppFavorites = imports.ui.appFavorites;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const DND = imports.ui.dnd;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceThumbnail = Me.imports.workspaceThumbnail;

const Convenience = Me.imports.convenience;
let settings = Convenience.getSettings('org.gnome.shell.extensions.gnomenu');

const Chromium = Me.imports.webChromium;
//const Epiphany = Me.imports.webEpiphany;
const Firefox = Me.imports.webFirefox;
const GoogleChrome = Me.imports.webGoogleChrome;
const Midori = Me.imports.webMidori;
const Opera = Me.imports.webOpera;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const gsVersion = Config.PACKAGE_VERSION.split('.');
const PlaceDisplay = Me.imports.placeDisplay;
const LoginManager = imports.misc.loginManager;


const PREFS_DIALOG = "gnome-shell-extension-prefs gnomenu@panacier.gmail.com";

const ShortcutsDisplay = {
    FAVORITES: 0,
    PLACES: 1
};

const StartupAppsDisplay = {
    ALL: 0,
    FREQUENT: 1,
    FAVORITES: 2,
    RECENT: 3,
    WEBMARKS: 4,
    NONE: 5
};

const SelectMethod = {
    HOVER: 0,
    CLICK: 1
};

const MenuLayout = {
    NORMAL: 0,
    COMPACT: 1
};

const ApplicationType = {
    APPLICATION: 0,
    PLACE: 1,
    RECENT: 2
};

const ApplicationsViewMode = {
    LIST: 0,
    GRID: 1
};

const MenuButtonPosition = {
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2
}

/* =========================================================================
/* name:    SearchWebBookmarks
 * @desc    Class to consolodate search of web browser(s) bookmarks
 * @desc    Code borrowed from SearchBookmarks extension by bmh1980
 * @desc    at https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================= */

const SearchWebBookmarks = new Lang.Class({
    Name: 'Gnomenu.SearchWebBookmarks',

    _init: function() {
        Chromium.init();
        //Epiphany.init();
        Firefox.init();
        GoogleChrome.init();
        Midori.init();
        Opera.init();
    },

    bookmarksSort: function(a, b) {
        if (a.score < b.score) return 1;
        if (a.score > b.score) return -1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    },

    destroy: function() {
        Chromium.deinit();
        //Epiphany.deinit();
        Firefox.deinit();
        GoogleChrome.deinit();
        Midori.deinit();
        Opera.deinit();
    }
});


/* =========================================================================
/* name:    CategoryListButton
 * @desc    A button with an icon that holds category info
 * ========================================================================= */

const CategoryListButton = new Lang.Class({
    Name: 'GnoMenu.CategoryListButton',

    _init: function (dir, altNameText, altIconName) {
        this.buttonEnterCallback = null;
        this.buttonLeaveCallback = null;
        this.buttonPressCallback = null;
        this.buttonReleaseCallback = null;
        this._ignoreHoverSelect = null;

        let style = "popup-menu-item popup-submenu-menu-item gnomenu-category-button";
        this.actor = new St.Button({ reactive: true, style_class: style, x_fill: true, y_fill: true, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout({style_class: 'gnomenu-category-button-box'});
        let iconSize = 28;

        this._dir = dir;
        let categoryNameText = "";
        let categoryIconName = null;

        if (typeof dir == 'string') {
            categoryNameText = altNameText;
            categoryIconName = altIconName;
        } else {
            categoryNameText = dir.get_name() ? dir.get_name() : "";
            if (altIconName) {
                categoryIconName = altIconName;
            } else {
                categoryIconName = dir.get_icon() ? dir.get_icon().get_names().toString() : "error";
            }
        }

        this.label = new St.Label({ text: categoryNameText, style_class: 'gnomenu-category-button-label' });
        this.buttonbox.add(this.label, {expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        if (categoryIconName) {
            this.iconWrapper = new St.Bin({style_class: 'gnomenu-category-button-icon'});
            this.icon = new St.Icon({icon_name: categoryIconName, icon_size: iconSize});
            this.iconWrapper.add_actor(this.icon);
            this.buttonbox.add(this.iconWrapper, {expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }

        this.actor.set_child(this.buttonbox);

        // Connect signals
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
    },

    setIconWrapperStyle: function(style) {
        this.iconWrapper.set_style(style);
    },

    clearIconWrapperStyle: function() {
        this.iconWrapper.set_style(null);
    },

    setButtonEnterCallback: function(cb) {
        this.buttonEnterCallback = cb;
        this.actor.connect('enter-event', Lang.bind(this, this.buttonEnterCallback));
    },

    setButtonLeaveCallback: function(cb) {
        this.buttonLeaveCallback = cb;
        this.actor.connect('leave-event', Lang.bind(this, this.buttonLeaveCallback));
    },

    setButtonPressCallback: function(cb) {
        this.buttonPressCallback = cb;
        this.actor.connect('button-press-event', Lang.bind(this, this.buttonPressCallback));
    },

    setButtonReleaseCallback: function(cb) {
        this.buttonReleaseCallback = cb;
        this.actor.connect('button-release-event', Lang.bind(this, this.buttonReleaseCallback));
    },

    select: function() {
        this._ignoreHoverSelect = true;
        this.buttonEnterCallback.call();
    },

    unSelect: function() {
        this._ignoreHoverSelect = false;
        this.buttonLeaveCallback.call();
    },

    click: function() {
        this.buttonPressCallback.call();
        this.buttonReleaseCallback.call();
    },

    _onTouchEvent : function (actor, event) {
        return Clutter.EVENT_PROPAGATE;
    }
});


/* =========================================================================
/* name:    ShortcutButton
 * @desc    A button with an icon that holds app info
 * ========================================================================= */

const ShortcutButton = new Lang.Class({
    Name: 'GnoMenu.ShortcutButton',

    _init: function (app, appType) {
        this._app = app;
        this._type = appType;
        let style = "popup-menu-item gnomenu-shortcut-button";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.START });
        this.actor._delegate = this;
        this._iconSize = (settings.get_int('shortcuts-icon-size') > 0) ? settings.get_int('shortcuts-icon-size') : 32;

        // appType 0 = application, appType 1 = place, appType 2 = recent
        if (appType == ApplicationType.APPLICATION) {
            this.icon = app.create_icon_texture(this._iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == ApplicationType.PLACE) {
            // Adjust 'places' symbolic icons by reducing their size
            // and setting a special class for button padding
            this._iconSize -= 4;
            this.actor.add_style_class_name('gnomenu-shortcut-symbolic-button');
            this.icon = new St.Icon({gicon: app.icon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-grid-button-label' });
        }
        //this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-shortcut-button-label' });

        this.buttonbox = new St.BoxLayout();
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        //this.buttonbox.add(this.label, {x_fill: false, y_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);

        // Connect signals
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));

        // Connect drag-n-drop signals
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
            }));
        this._draggable.connect('drag-cancelled', Lang.bind(this,
            function () {
                Main.overview.cancelledItemDrag(this);
            }));
        this._draggable.connect('drag-end', Lang.bind(this,
            function () {
               Main.overview.endItemDrag(this);
            }));
    },

    _onTouchEvent : function (actor, event) {
        return Clutter.EVENT_PROPAGATE;
    },

    getDragActor: function() {
        let appIcon;
        if (this._type == ApplicationType.APPLICATION) {
            appIcon = this._app.create_icon_texture(this._iconSize);
        } else if (this._type == ApplicationType.PLACE) {
            appIcon = new St.Icon({gicon: this._app.icon, icon_size: this._iconSize});
        } else if (this._type == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(this._app.mime);
            appIcon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
        }
        return appIcon;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.icon;
    },

    shellWorkspaceLaunch : function(params) {
        params = Params.parse(params, { workspace: -1,
                                        timestamp: 0 });

        if (this._type == ApplicationType.APPLICATION) {
            this._app.open_new_window(params.workspace);
        } else if (this._type == ApplicationType.PLACE) {
           if (this._app.uri) {
               this._app.app.launch_uris([this._app.uri], null);
           } else {
               this._app.launch();
           }
        } else if (this._type == ApplicationType.RECENT) {
            Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
        }

        this.actor.remove_style_pseudo_class('pressed');
        this.actor.remove_style_class_name('selected');

        if (GnoMenu.appsMenuButton) {
            if (GnoMenu.appsMenuButton.menu.isOpen)
                GnoMenu.appsMenuButton.menu.toggle();
        }
    }
});


/* =========================================================================
/* name:    AppListButton
 * @desc    A button with an icon and label that holds app info for various
 * @desc    types of sources (application, places, recent)
 * ========================================================================= */

const AppListButton = new Lang.Class({
    Name: 'GnoMenu.AppListButton',

    _init: function (app, appType) {
        this._app = app;
        this._type = appType;
        this._stateChangedId = 0;
        let style = "popup-menu-item gnomenu-application-list-button";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.actor._delegate = this;
        this._iconSize = (settings.get_int('apps-list-icon-size') > 0) ? settings.get_int('apps-list-icon-size') : 28;

        // appType 0 = application, appType 1 = place, appType 2 = recent
        if (appType == ApplicationType.APPLICATION) {
            this.icon = app.create_icon_texture(this._iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-application-list-button-label' });
        } else if (appType == ApplicationType.PLACE) {
            this.icon = new St.Icon({gicon: app.icon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-list-button-label' });
        } else if (appType == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-list-button-label' });
        }

        this._dot = new St.Widget({ style_class: 'app-well-app-running-dot',
                                    layout_manager: new Clutter.BinLayout(),
                                    x_expand: true, y_expand: true,
                                    x_align: Clutter.ActorAlign.CENTER,
                                    y_align: Clutter.ActorAlign.END });

        this._iconContainer = new St.BoxLayout({vertical: true});
        this._iconContainer.add_style_class_name('gnomenu-application-list-button-icon');

        this._iconContainer.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.END});
        this._iconContainer.add(this._dot, {x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.END});

        this.buttonbox = new St.BoxLayout();
        this.buttonbox.add(this._iconContainer, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.buttonbox.add(this.label, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);

        // Connect signals
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
        if (appType == ApplicationType.APPLICATION) {
            this._stateChangedId = this._app.connect('notify::state', Lang.bind(this, this._onStateChanged));
        }

        // Connect drag-n-drop signals
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
            }));
        this._draggable.connect('drag-cancelled', Lang.bind(this,
            function () {
                Main.overview.cancelledItemDrag(this);
            }));
        this._draggable.connect('drag-end', Lang.bind(this,
            function () {
               Main.overview.endItemDrag(this);
            }));

        // Check if running state
        this._dot.opacity = 0;
        this._onStateChanged();
    },

    _onTouchEvent : function (actor, event) {
        return Clutter.EVENT_PROPAGATE;
    },

    _onStateChanged: function() {
        if (this._type == ApplicationType.APPLICATION) {
            if (this._app.state != Shell.AppState.STOPPED) {
                this._dot.opacity = 255;
            } else {
                this._dot.opacity = 0;
            }
        }
    },

    getDragActor: function() {
        let appIcon;
        if (this._type == ApplicationType.APPLICATION) {
            appIcon = this._app.create_icon_texture(this._iconSize);
        } else if (this._type == ApplicationType.PLACE) {
            appIcon = new St.Icon({gicon: this._app.icon, icon_size: this._iconSize});
        } else if (this._type == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(this._app.mime);
            appIcon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
        }
        return appIcon;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.icon;
    },

    shellWorkspaceLaunch : function(params) {
        params = Params.parse(params, { workspace: -1,
                                        timestamp: 0 });

        if (this._type == ApplicationType.APPLICATION) {
            this._app.open_new_window(params.workspace);
        } else if (this._type == ApplicationType.PLACE) {
           if (this._app.uri) {
               this._app.app.launch_uris([this._app.uri], null);
           } else {
               this._app.launch();
           }
        } else if (this._type == ApplicationType.RECENT) {
            Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
        }

        this.actor.remove_style_pseudo_class('pressed');
        this.actor.remove_style_class_name('selected');

        if (GnoMenu.appsMenuButton) {
            if (GnoMenu.appsMenuButton.menu.isOpen)
                GnoMenu.appsMenuButton.menu.toggle();
        }
    }
});
Signals.addSignalMethods(AppListButton.prototype);


/* =========================================================================
/* name:    AppGridButton
 * @desc    A button with an icon and label that holds app info for various
 * @desc    types of sources (application, places, recent)
 * ========================================================================= */

const AppGridButton = new Lang.Class({
    Name: 'GnoMenu.AppGridButton',

    _init: function(app, appType, includeText) {
        this._app = app;
        this._type = appType;
        this._stateChangedId = 0;
        let styleButton = "popup-menu-item gnomenu-application-grid-button";

        let styleLabel = "gnomenu-application-grid-button-label";
        if (settings.get_int('apps-grid-column-count') == 3) {
            styleButton += " col3";
        } else if (settings.get_int('apps-grid-column-count') == 4) {
            styleButton += " col4";
        } else if (settings.get_int('apps-grid-column-count') == 5) {
            styleButton += " col5";
        } else if (settings.get_int('apps-grid-column-count') == 6) {
            styleButton += " col6";
        } else if (settings.get_int('apps-grid-column-count') == 7) {
            styleButton += " col7";
        }
        if (settings.get_boolean('hide-categories')) {
            styleButton += " no-categories";
            styleLabel += " no-categories";
        }

        this.actor = new St.Button({reactive: true, style_class: styleButton, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        this.actor._delegate = this;
        this._iconSize = (settings.get_int('apps-grid-icon-size') > 0) ? settings.get_int('apps-grid-icon-size') : 64;

        // appType 0 = application, appType 1 = place, appType 2 = recent
        if (appType == ApplicationType.APPLICATION) {
            this.icon = app.create_icon_texture(this._iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: styleLabel });
        } else if (appType == ApplicationType.PLACE) {
            this.icon = new St.Icon({gicon: app.icon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: styleLabel });
        } else if (appType == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: styleLabel });
        }

        this._dot = new St.Widget({ style_class: 'app-well-app-running-dot',
                                    layout_manager: new Clutter.BinLayout(),
                                    x_expand: true, y_expand: true,
                                    x_align: Clutter.ActorAlign.CENTER,
                                    y_align: Clutter.ActorAlign.END });

        this.buttonbox = new St.BoxLayout({vertical: true});
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
        if(includeText){
            // Use pango to wrap label text
            //this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
            //this.label.clutter_text.line_wrap = true;
            this.buttonbox.add(this.label, {x_fill: false, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        this.buttonbox.add(this._dot, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
        this.actor.set_child(this.buttonbox);

        // Connect signals
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
        if (appType == ApplicationType.APPLICATION) {
            this._stateChangedId = this._app.connect('notify::state', Lang.bind(this, this._onStateChanged));
        }

        // Connect drag-n-drop signals
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
            }));
        this._draggable.connect('drag-cancelled', Lang.bind(this,
            function () {
                Main.overview.cancelledItemDrag(this);
            }));
        this._draggable.connect('drag-end', Lang.bind(this,
            function () {
               Main.overview.endItemDrag(this);
            }));

        // Check if running state
        this._dot.opacity = 0;
        this._onStateChanged();
    },

    _onTouchEvent : function (actor, event) {
        return Clutter.EVENT_PROPAGATE;
    },

    _onStateChanged: function() {
        if (this._type == ApplicationType.APPLICATION) {
            if (this._app.state != Shell.AppState.STOPPED) {
                this._dot.opacity = 255;
            } else {
                this._dot.opacity = 0;
            }
        }
    },

    getDragActor: function() {
        let appIcon;
        if (this._type == ApplicationType.APPLICATION) {
            appIcon = this._app.create_icon_texture(this._iconSize);
        } else if (this._type == ApplicationType.PLACE) {
            appIcon = new St.Icon({gicon: this._app.icon, icon_size: this._iconSize});
        } else if (this._type == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(this._app.mime);
            appIcon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
        }
        return appIcon;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.icon;
    },

    shellWorkspaceLaunch : function(params) {
        params = Params.parse(params, { workspace: -1,
                                        timestamp: 0 });

        if (this._type == ApplicationType.APPLICATION) {
            this._app.open_new_window(params.workspace);
        } else if (this._type == ApplicationType.PLACE) {
           if (this._app.uri) {
               this._app.app.launch_uris([this._app.uri], null);
           } else {
               this._app.launch();
           }
        } else if (this._type == ApplicationType.RECENT) {
            Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
        }

        this.actor.remove_style_pseudo_class('pressed');
        this.actor.remove_style_class_name('selected');

        if (GnoMenu.appsMenuButton) {
            if (GnoMenu.appsMenuButton.menu.isOpen)
                GnoMenu.appsMenuButton.menu.toggle();
        }
    }
});
Signals.addSignalMethods(AppGridButton.prototype);


/* =========================================================================
/* name:    GroupButton
 * @desc    A generic icon button
 * @impl    Used for user/power group buttons
 * ========================================================================= */

const GroupButton = new Lang.Class({
    Name: 'GnoMenu.GroupButton',

    _init: function(iconName, iconSize, labelText, params) {
        this._opened = false;
        this.buttonEnterCallback = null;
        this.buttonLeaveCallback = null;
        this.buttonPressCallback = null;
        this.buttonReleaseCallback = null;
        let style = "popup-menu-item popup-submenu-menu-item";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor.add_style_class_name(params.style_class);

        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout({vertical: true});

        if (iconName && iconSize) {
            this._iconSize = iconSize;
            //this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize, icon_type: St.IconType.SYMBOLIC});
            this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize});
            this.buttonbox.add(this.icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        if (labelText) {
            this.label = new St.Label({ text: labelText, style_class: params.style_class+'-label' });
            // Use pango to wrap label text
            //this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
            //this.label.clutter_text.line_wrap = true;
            this.buttonbox.add(this.label, {x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        this.actor.set_child(this.buttonbox);

        // Connect signals
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
    },

    setIcon: function(iconName) {
        let newIcon = new St.Icon({icon_name: iconName, icon_size: this._iconSize});
        this.buttonbox.replace_child(this.icon, newIcon);
        this.icon.destroy();
        this.icon = newIcon;
    },

    setButtonEnterCallback: function(cb) {
        this.buttonEnterCallback = cb;
        this.actor.connect('enter-event', Lang.bind(this, this.buttonEnterCallback));
    },

    setButtonLeaveCallback: function(cb) {
        this.buttonLeaveCallback = cb;
        this.actor.connect('leave-event', Lang.bind(this, this.buttonLeaveCallback));
    },

    setButtonPressCallback: function(cb) {
        this.buttonPressCallback = cb;
        this.actor.connect('button-press-event', Lang.bind(this, this.buttonPressCallback));
    },

    setButtonReleaseCallback: function(cb) {
        this.buttonReleaseCallback = cb;
        this.actor.connect('button-release-event', Lang.bind(this, this.buttonReleaseCallback));
    },

    select: function() {
        this.buttonEnterCallback.call();
    },

    unSelect: function() {
        this.buttonLeaveCallback.call();
    },

    click: function() {
        this.buttonPressCallback.call();
        this.buttonReleaseCallback.call();
    },

    _onTouchEvent : function (actor, event) {
        return Clutter.EVENT_PROPAGATE;
    }
});
Signals.addSignalMethods(GroupButton.prototype);


/* =========================================================================
/* name:    PanelButton
 * @desc    A top panel button
 * @impl    Used for view/apps buttons on top panel
 * ========================================================================= */

const PanelButton = new Lang.Class({
    Name: 'GnoMenu.PanelButton',
    Extends: PanelMenu.Button,

    _init: function(nameText, iconName) {
        this.parent(0.0, '', true);

        this._box = new St.BoxLayout({ style_class: 'gnomenu-panel-button' });
        this.actor.add_actor(this._box);

        // Add icon to button
        if (iconName) {
            let icon = new St.Icon({ gicon: null, style_class: 'system-status-icon gnomenu-panel-menu-icon' });
            this._box.add(icon, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
            icon.icon_name = iconName;
        }

        // Add label to button
        if (nameText.length > 0) {
                let label = new St.Label({ text: ' '+nameText});
                let labelWrapper = new St.Bin();
                labelWrapper.set_child(label);
                this._box.add(labelWrapper, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        }
    }
});


/* =========================================================================
/* name:    PanelMenuButton
 * @desc    A top panel button the toggles a popup menu
 * @impl    Used for menu button on top panel
 * ========================================================================= */

const PanelMenuButton = new Lang.Class({
    Name: 'GnoMenu.PanelMenuButton',
    Extends: PanelMenu.Button,

    _init: function() {

        // NOTE: can't get label to take using this method. Possible Gnome Shell bug?
        this.parent(0.0, '');

        this.actor.add_style_class_name('panel-button');
        this._bin = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._box = new St.BoxLayout({ style_class: 'gnomenu-panel-menu-button' });

        this._bin.add_child(this._box);
        this.actor.add_actor(this._bin);


        // Add hotspot area 1px high at top of PanelMenuButton
        if (!settings.get_boolean('disable-panel-menu-hotspot')) {
            this._hotspot = new Clutter.Actor({reactive: true, opacity:0, x_expand: true});
            this._hotspot.y = 0;
            this._hotspot.height = 1;
            this._bin.add_child(this._hotspot);
            this._hotspot.connect('enter-event', Lang.bind(this, this._onHotSpotEntered));
            this._hotspot.connect('leave-event', Lang.bind(this, this._onHotSpotExited));
        }

        // Add icon to button
        if (settings.get_boolean('use-panel-menu-icon')) {
            let icon = new St.Icon({ gicon: null, style_class: 'system-status-icon gnomenu-panel-menu-icon' });
            this._box.add(icon, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
            if (settings.get_boolean('use-panel-menu-icon')) {
                icon.icon_name = settings.get_strv('panel-menu-icon-name')[0];
            }
        }

        // Add label to button
        let labelText = settings.get_strv('panel-menu-label-text')[0];
        if (labelText.length > 0) {
            let label = new St.Label({ text: ' '+labelText});
            let labelWrapper = new St.Bin();
            labelWrapper.set_child(label);
            this._box.add(labelWrapper, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        }

        // Add arrow to button
        if (!settings.get_boolean('hide-panel-menu-arrow')) {
            this._box.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
        }

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));
        this.actor.connect('key-press-event', Lang.bind(this, this._onPanelMenuKeyPress));
        this.menu.actor.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));

        this.applicationsByCategory = {};
        this.favorites = [];
        this.frequentApps = [];
        this._applications = [];
        this._places = [];
        this._recent = [];

        this._applicationsViewMode = settings.get_enum('startup-view-mode');
        this._appGridColumns = settings.get_int('apps-grid-column-count');
        this._appGridButtonWidth = settings.get_int('apps-grid-label-width');
        this._appGridButtonHeight = null;
        this._hoverTimeoutId = 0;
        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;

        this._searchWebBookmarks = new SearchWebBookmarks();
        this._searchWebErrorsShown = false;
        this._session = new GnomeSession.SessionManager();
        this.recentManager = Gtk.RecentManager.get_default();
        this.placesManager = null;
        this._display();
    },

    destroy: function() {
        this.parent();
        this._searchWebBookmarks.destroy();
    },

    // handler for when PanelMenuButton hotspot enter event
    _onHotSpotEntered: function() {
        if (_DEBUG_) global.log("PanelMenuButton: _onHotSpotEntered");
        let hoverDelay = settings.get_int('panel-menu-hotspot-delay');
        this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
            //if (!this.menu.isOpen) {
                this.menu.toggle();
            //}
            this._hoverTimeoutId = 0;
         }));
    },

    // handler for when PanelMenuButton hotspot leave event
    _onHotSpotExited: function() {
        if (_DEBUG_) global.log("PanelMenuButton: _onHotSpotExited");
        if (this._hoverTimeoutId > 0) {
            Mainloop.source_remove(this._hoverTimeoutId);
        }
    },

    _onOpenStateToggled: function(menu, open) {
        if (open) {
            // SANITY CHECK - verify hotspot location --------
            //let [x, y] = this.actor.get_transformed_position();
            //let [w, h] = this.actor.get_size();
            //x = Math.floor(x);
            //w = Math.floor(w);
            //global.log("PanelMenuButton: _onOpenStateToggled x="+x+"  w="+w);
            // -----------------------------------------------

            // Reset search
            this.resetSearch();

            // Load Startup Applications category
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._applications = [];
            this._places = [];
            this._recent = [];
            this._applicationsViewMode = settings.get_enum('startup-view-mode');
            this._appGridColumns = settings.get_int('apps-grid-column-count');
            this.recentCategory._opened = false;
            this.webBookmarksCategory._opened = false;

            // Set height (we also set constraints on scrollboxes
            // Why does height need to be set when already set constraints? because of issue noted below
            // ISSUE: If height isn't set, then popup menu height will expand when application buttons are added
            let height = this.categoriesScrollBox.height;
            this.applicationsScrollBox.height = height;
            this.shortcutsScrollBox.height = height;

            // Set workspace thumbnails height (width scaled to size based on height)
            this.thumbnailsBoxFiller.height = height;
            this.thumbnailsBoxFiller.width = 0;
            this.workspacesWrapper.height = height;
            this.thumbnailsBox._createThumbnails();
            this.thumbnailsBox.actor.set_position(1, 0); // position inside wrapper
            if (settings.get_boolean('hide-workspaces')) {
                this.workspacesWrapper.width = 0;
                this.thumbnailsBox.actor.hide();
                this.workspacesWrapper.hide();
            } else {
                this.workspacesWrapper.width = this.thumbnailsBox.actor.width;
                this.thumbnailsBox.actor.show();
                this.workspacesWrapper.show();
            }

            // Set height of userGroupBox, viewModeBox, and powerGroupBox to searchBox
            this.userGroupBox.height = this.searchBox.height;
            this.viewModeBox.height = this.searchBox.height;
            this.powerGroupBox.height = this.searchBox.height;
            this._setButtonHeight(this.recentCategory.actor, this.searchBox.height);
            this._setButtonHeight(this.webBookmarksCategory.actor, this.searchBox.height);
            this._setButtonHeight(this.toggleStartupAppsView.actor, this.searchBox.height);
            this._setButtonHeight(this.toggleListGridView.actor, this.searchBox.height);
            this._setButtonHeight(this.systemRestart.actor, this.searchBox.height);
            this._setButtonHeight(this.systemSuspend.actor, this.searchBox.height);
            this._setButtonHeight(this.systemShutdown.actor, this.searchBox.height);
            this._setButtonHeight(this.logoutUser.actor, this.searchBox.height);
            this._setButtonHeight(this.lockScreen.actor, this.searchBox.height);
            this._setButtonHeight(this.extensionPreferences.actor, this.searchBox.height);

            // Set shortcuts width
            if (!settings.get_boolean('hide-shortcuts')) {
                this._widthShortcutsBox = this.shortcutsScrollBox.width;
            }

            // Set initial categories width
            if (!settings.get_boolean('hide-categories')) {
                this._widthCategoriesBox = this.categoriesScrollBox.width;
            }

            // Adjust width of categories box and depending on if shortcuts are shown
            // But also take into account the width of the user and power group boxes

            // Adjust category & power group widths
            let widthCategoryPowerGroup = this._widthCategoriesBox;
            if (this.powerGroupBox.width > this._widthCategoriesBox + this._widthShortcutsBox) {
                widthCategoryPowerGroup = this.powerGroupBox.width - this._widthShortcutsBox;
                if (!settings.get_boolean('hide-categories')) {
                    this._widthCategoriesBox = widthCategoryPowerGroup;
                }
            } else {
                this.powerGroupBox.width = this._widthCategoriesBox + this._widthShortcutsBox;
            }
            this.categoriesScrollBox.width = this._widthCategoriesBox;
            this.categoriesBox.width = this._widthCategoriesBox;

            // Adjust for user themes
            this._adjustThemeForCompatibility();

            // Set startup apps view
            this._startupAppsView = settings.get_enum('startup-apps-display');

            // Hide applications list/grid box depending on view mode
            if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
                this.toggleListGridView.setIcon('view-grid-symbolic');
                this._switchApplicationsView(ApplicationsViewMode.LIST);
            } else {
                this.toggleListGridView.setIcon('view-list-symbolic');
                this._switchApplicationsView(ApplicationsViewMode.GRID);
            }

            // Wait before calculating the applications scroll box and displaying
            // the startup applications
            // NOTE: We do this because the workspace thumbnails have to be created
            // before calculating the applications scroll box width
            if (this._menuToggleTimeoutId > 0)
                Mainloop.source_remove(this._menuToggleTimeoutId);

            this._menuToggleTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, this.delayToggle));

        } else {
            this.resetSearch();
            this._clearCategorySelections(this.categoriesBox);
            this._clearUserGroupButtons();
            this._clearTabFocusSelections();
            this._clearActiveContainerSelections();
            this._clearApplicationsBox();
            global.stage.set_key_focus(null);

            if (this._menuToggleTimeoutId > 0)
                Mainloop.source_remove(this._menuToggleTimeoutId);

            this.thumbnailsBox._destroyThumbnails();
        }
    },

    delayToggle: function() {
        this._calculateApplicationsBoxWidth();
        this._resetDisplayApplicationsToStartup();
    },

    refresh: function() {
        this._clearAll();
        this._display();
    },

    _clearAll: function() {
        this.menu.removeAll();
    },

    _setButtonHeight: function(button, height) {
        let adjustedHeight = height;
        let buttonMargin, buttonBorder, buttonPadding;
        if (button.get_stage()) {
            let themeNode = button.get_theme_node();
            buttonMargin = {
                left: themeNode.get_margin(St.Side.LEFT),
                top: themeNode.get_margin(St.Side.TOP),
                bottom: themeNode.get_margin(St.Side.BOTTOM),
                right: themeNode.get_margin(St.Side.RIGHT),
            };
            buttonBorder = {
                left: themeNode.get_border_width(St.Side.LEFT),
                top: themeNode.get_border_width(St.Side.TOP),
                bottom: themeNode.get_border_width(St.Side.BOTTOM),
                right: themeNode.get_border_width(St.Side.RIGHT),
            };
            buttonPadding = {
                left: themeNode.get_padding(St.Side.LEFT),
                top: themeNode.get_padding(St.Side.TOP),
                bottom: themeNode.get_padding(St.Side.BOTTOM),
                right: themeNode.get_padding(St.Side.RIGHT),
            };
            adjustedHeight = height - (buttonBorder.top + buttonBorder.bottom + buttonPadding.top + buttonPadding.bottom);
        }
        button.height = adjustedHeight;
    },

    _loadCategories: function(dir, root) {
        var rootDir = root;
        //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - dir="+dir.get_menu_id()+" root="+rootDir);
        var iter = dir.iter();
        var nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - TreeItemType.ENTRY");
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - entry valid");
                    var app = Shell.AppSystem.get_default().lookup_app(entry.get_desktop_file_id());
                    if (rootDir) {
                        //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - push root.get_menu_id = "+rootDir.get_menu_id());
                        if (rootDir.get_menu_id())
                            this.applicationsByCategory[rootDir.get_menu_id()].push(app);
                    } else {
                        //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - push dir.get_menu_id = "+dir.get_menu_id());
                        if (dir.get_menu_id())
                            this.applicationsByCategory[dir.get_menu_id()].push(app);
                    }
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                //if (_DEBUG_) global.log("PanelMenuButton: _loadCategories - TreeItemType.DIRECTORY");
                if (rootDir) {
                    this._loadCategories(iter.get_directory(), rootDir);
                } else {
                    this._loadCategories(iter.get_directory(), dir);
                }
            }
        }
    },

    _selectCategory: function(button) {
        this.resetSearch();
        this._clearUserGroupButtons();
        this._clearApplicationsBox(button);
        let category = button._dir;
        if (typeof category == 'string') {
            this._displayApplications(this._listApplications(category));
        } else {
            this._displayApplications(this._listApplications(category.get_menu_id()));
        }
    },

    _selectFavorites: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let favorites = this.favorites;
        this._displayApplications(favorites);
    },

    _selectAllPlaces: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let places = this._listPlaces();
        let bookmarks = this._listBookmarks();
        let devices = this._listDevices();

        let allPlaces = places.concat(bookmarks.concat(devices));
        this._displayApplications(null, allPlaces);
    },

    _selectBookmarks: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let bookmarks = this._listBookmarks();
        this._displayApplications(null, bookmarks);
    },

    _selectDevices: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let devices = this._listDevices();
        this._displayApplications(null, devices);
    },

    _selectRecent: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let recent = this._listRecent();
        this._displayApplications(null, null, recent);
    },

    _selectWebBookmarks: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let webBookmarks = this._listWebBookmarks();
        this._displayApplications(null, webBookmarks);
    },

    _switchApplicationsView: function(mode) {
        this._applicationsViewMode = mode;
        let refresh = true;

        if (mode == ApplicationsViewMode.LIST) {
            this.applicationsListBox.show();
            this.applicationsGridBox.hide();
        } else {
            this.applicationsListBox.hide();
            this.applicationsGridBox.show();
        }

        // switch activeContainer and reset _selectedItemIndex for keyboard navigation
        if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {

            // reset active container
            this._activeContainer = (mode == 0) ? this.applicationsListBox : this.applicationsGridBox;
            this._selectedItemIndex = -1;

            // reset scroll to top
            let vscroll = this.applicationsScrollBox.get_vscroll_bar();
            var new_scroll_value = this.applicationsScrollBox.get_allocation_box().y1;
            vscroll.get_adjustment().set_value(new_scroll_value);
        }

        this._clearApplicationsBox(null, refresh);
        this._displayApplications(null, null, null, refresh);
    },

    _clearCategorySelections: function(container, selectedCategory) {
        let categoryActors = container.get_children();
        if (categoryActors) {
            for (let i = 0; i < categoryActors.length; i++) {
                let actor = categoryActors[i];
                if (selectedCategory && (actor == selectedCategory.actor)) {
                    if (this._styleColor) actor._delegate.setIconWrapperStyle(this._styleColor);
                } else {
                    actor._delegate.clearIconWrapperStyle();
                }
            }
        }
    },

    _clearUserGroupButtons: function() {
        this.recentCategory._opened = false;
        this.webBookmarksCategory._opened = false;
    },

    _clearTabFocusSelections: function(selectedBox, resetSearch) {
        this._selectedItemIndex = -1;
        this._clearActiveContainerSelections();
        this._adjustThemeForCompatibility();

        if (!selectedBox)
            return;

        if (selectedBox == this.searchEntry)
            return;

        // let focusStyle = "border-width:1px; border-color: rgba(304,89,41,1)";
        let focusStyle = "";
        if (selectedBox == this.applicationsGridBox || selectedBox == this.applicationsListBox) {
            let wrapper = this.applicationsBoxWrapper;
            wrapper.set_style(focusStyle);
        } else if (selectedBox == this.categoriesBox) {
            let wrapper = this.categoriesScrollBox;
            wrapper.set_style(focusStyle);
        } else if (selectedBox == this.thumbnailsBox) {
            let wrapper = this.workspacesScrollBox;
            wrapper.set_style(focusStyle);
        } else if (selectedBox == this.shortcutsBox) {
            let wrapper = this.shortcutsScrollBox;
            wrapper.set_style(focusStyle);
        } else {
            selectedBox.set_style(focusStyle);
        }

        if (selectedBox!=this.searchEntry && resetSearch)
            this.resetSearch();
    },

    _clearActiveContainerSelections: function(selectedContainerActor) {
        if (!this._activeContainer)
            return;

        // Deal with extensionPreferences actor separately
        // because it's not in any of the activeContainer objects
        if (this.extensionPreferences == selectedContainerActor) {
            this.extensionPreferences.actor.add_style_class_name('selected');
            if (this.extensionPreferences.actor._delegate && this.extensionPreferences.actor._delegate.select) {
                this.extensionPreferences.actor._delegate.select();
            }
        } else {
            this.extensionPreferences.actor.remove_style_class_name('selected');
        }

        // Return if activeContainer has no children
        // Such is the case with the thumbnailsBox
        if (!this._activeContainer.get_children || this._activeContainer == this.searchEntry)
            return;

        this._activeContainer.get_children().forEach(function(actor) {
            if (selectedContainerActor) {
                if (selectedContainerActor && (actor == selectedContainerActor)) {
                    actor.add_style_class_name('selected');
                    if (actor._delegate && actor._delegate.select)
                        actor._delegate.select();
                } else {
                    actor.remove_style_class_name('selected');
                }
            } else {
                actor.remove_style_class_name('selected');
                if (actor._delegate && actor._delegate.unSelect)
                    actor._delegate.unSelect();
            }
        });
    },

    _clearApplicationSelections: function(selectedApplication) {
        this.applicationsListBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_class_name('selected');
            } else {
                actor.remove_style_class_name('selected');
            }
        });

        this.applicationsGridBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_class_name('selected');
            } else {
                actor.remove_style_class_name('selected');
            }
        });
    },

    _clearApplicationsBox: function(selectedCategory, refresh){
        let listActors = this.applicationsListBox.get_children();
        if (listActors) {
            for (let i=0; i<listActors.length; i++) {
                let actor = listActors[i];
                this.applicationsListBox.remove_actor(actor);
            }
        }

        let gridActors = this.applicationsGridBox.get_children();
        if (gridActors) {
            for (let i=0; i<gridActors.length; i++) {
                let actor = gridActors[i];
                this.applicationsGridBox.remove_actor(actor);
            }
        }

        // Don't want to clear selected category if just refreshing because of view mode change
        if (refresh)
            return;

        let categoryActors = this.categoriesBox.get_children();
        if (categoryActors) {
            for (let i = 0; i < categoryActors.length; i++) {
                let actor = categoryActors[i];
                if (selectedCategory && (actor == selectedCategory.actor)) {
                    if (this._styleColor) actor._delegate.setIconWrapperStyle(this._styleColor);
                } else {
                    actor._delegate.clearIconWrapperStyle();
                }
            }
        }
    },

    _listPlaces: function(pattern) {
        if (!this.placesManager)
            return null;
        let places = this.placesManager.getDefaultPlaces();
        let res = [];
        for (let id = 0; id < places.length; id++) {
            if (!pattern || places[id].name.toLowerCase().indexOf(pattern)!=-1)
                res.push(places[id]);
        }
        return res;
    },

    _listBookmarks: function(pattern){
        if (!this.placesManager)
            return null;
        let bookmarks = this.placesManager.getBookmarks();
        let res = [];
        for (let id = 0; id < bookmarks.length; id++) {
            if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1)
                res.push(bookmarks[id]);
        }
        return res;
    },

    _listWebBookmarks: function(pattern) {
        if (_DEBUG_) global.log("PanelMenuButton: _listWebBookmarks");
        if (!this._searchWebErrorsShown) {
            if (!Firefox.Gda) {
                let notifyTitle = _("Gno-Menu: Search Firefox bookmarks disabled");
                let notifyMessage = _("If you want to search Firefox bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]");
                this.selectedAppTitle.set_text(notifyTitle);
                this.selectedAppDescription.set_text(notifyMessage);
            }
            if (!Midori.Gda) {
                let notifyTitle = _("Gno-Menu: Search Midori bookmarks disabled");
                let notifyMessage = _("If you want to search Midori bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]");
                this.selectedAppTitle.set_text(notifyTitle);
                this.selectedAppDescription.set_text(notifyMessage);
            }
        }
        this._searchWebErrorsShown = true;

        let res = [];
        let searchResults = [];
        let bookmarks = [];

        bookmarks = bookmarks.concat(Chromium.bookmarks);
        //bookmarks = bookmarks.concat(Epiphany.bookmarks);
        bookmarks = bookmarks.concat(Firefox.bookmarks);
        bookmarks = bookmarks.concat(GoogleChrome.bookmarks);
        bookmarks = bookmarks.concat(Midori.bookmarks);
        bookmarks = bookmarks.concat(Opera.bookmarks);

        for (let id = 0; id < bookmarks.length; id++) {
            if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1) {
                res.push({
                    app:   bookmarks[id].appInfo,
                    name:   bookmarks[id].name,
                    icon:   bookmarks[id].appInfo.get_icon(),
                    mime:   null,
                    uri:    bookmarks[id].uri
                });
            }
        }

        res.sort(this._searchWebBookmarks.bookmarksSort);
        return res;
    },

    _listDevices: function(pattern) {
        if (!this.placesManager)
            return null;
        let devices = this.placesManager.getMounts();
        let res = new Array();
        for (let id = 0; id < devices.length; id++) {
            if (!pattern || devices[id].name.toLowerCase().indexOf(pattern)!=-1)
                res.push(devices[id]);
        }
        return res;
    },

    _listRecent: function(pattern) {
        let recentFiles = this.recentManager.get_items();
        let res = new Array();

        for (let id = 0; id < recentFiles.length; id++) {
            let recentInfo = recentFiles[id];
            if (recentInfo.exists()) {
                if (!pattern || recentInfo.get_display_name().toLowerCase().indexOf(pattern)!=-1) {
                    res.push({
                        name:   recentInfo.get_display_name(),
                        icon:   recentInfo.get_gicon(),
                        mime:   recentInfo.get_mime_type(),
                        uri:    recentInfo.get_uri()
                    });
                }
            }
        }
        return res;
    },

    _listApplications: function(category_menu_id, pattern) {
        let applist;

        if (category_menu_id == 'all') {
            applist = [];
            for (let directory in this.applicationsByCategory)
                applist = applist.concat(this.applicationsByCategory[directory]);
        } else if (category_menu_id == 'frequent') {
            applist = this.frequentApps;
        } else if (category_menu_id == 'favorites') {
            applist = this.favorites;
        } else {
            if (category_menu_id) {
                applist = this.applicationsByCategory[category_menu_id];
            } else {
                applist = [];
                for (let directory in this.applicationsByCategory)
                    applist = applist.concat(this.applicationsByCategory[directory]);
            }
        }

        let res;
        if (pattern) {
            res = [];
            for (let i in applist) {
                let app = applist[i];
                let info = Gio.DesktopAppInfo.new (app.get_id());
                if (
                    app.get_name().toLowerCase().indexOf(pattern)!=-1
                    || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1)
                    || (info && info.get_display_name() && info.get_display_name().toLowerCase().indexOf(pattern)!=-1)
                    || (info && info.get_executable() && info.get_executable().toLowerCase().indexOf(pattern)!=-1)
                    || (info && info.get_keywords() && info.get_keywords().toString().toLowerCase().indexOf(pattern)!=-1)
                )
                    res.push(app);
            }
        } else {
            res = applist;
        }

        // Ignore favorites when sorting
        if (category_menu_id != 'favorites') {
            res.sort(function(a,b) {
                return a.get_name().toLowerCase() > b.get_name().toLowerCase();
            });
        }

        return res;
    },

    _adjustThemeForCompatibility: function() {
        // Adjust menu and top pane padding from theme
        if (this.menu._boxPointer.bin.get_stage()) {
            let child = this.menu._boxPointer.bin.get_child();
            let themeNode = child.get_theme_node();
            let menuPadding = null;
            let menuMargin = null;
            menuMargin = {
                left: themeNode.get_margin(St.Side.LEFT),
                top: themeNode.get_margin(St.Side.TOP),
                bottom: themeNode.get_margin(St.Side.BOTTOM),
                right: themeNode.get_margin(St.Side.RIGHT),
            };
            menuPadding = {
                left: themeNode.get_padding(St.Side.LEFT),
                top: themeNode.get_padding(St.Side.TOP),
                bottom: themeNode.get_padding(St.Side.BOTTOM),
                right: themeNode.get_padding(St.Side.RIGHT),
            };
            child.set_style("padding-left:"+menuPadding.top+"px; padding-right:"+menuPadding.top+"px");
            this.topPane.set_style("padding-bottom:"+menuPadding.top+"px");
        }

        // Adjust certain menu objects for theme color, border, etc.
        let separatorBorderColor = null, separatorBorderColorAlpha = "1";
        let styleBorderColor = "", styleBackgroundColor = "", styleColor = "";
        if (this._dummySeparator._separator.get_stage()) {
            let themeNode = this._dummySeparator._separator.get_theme_node();
            separatorBorderColor = themeNode.get_border_color(St.Side.TOP);
            if (separatorBorderColor.alpha) {
                separatorBorderColorAlpha = separatorBorderColor.alpha / 255;
            }
            styleBorderColor = "border-color: rgba(" + separatorBorderColor.red + "," + separatorBorderColor.green + "," + separatorBorderColor.blue + "," + separatorBorderColorAlpha + ")";
            styleBackgroundColor = "background-color: rgba(" + separatorBorderColor.red + "," + separatorBorderColor.green + "," + separatorBorderColor.blue + "," +  separatorBorderColorAlpha + ")";
            styleColor = "color: rgba(" + separatorBorderColor.red + "," + separatorBorderColor.green + "," + separatorBorderColor.blue + "," +  separatorBorderColorAlpha + ")";

        }

        // Style used by category buttons to indicate selected state
        this._styleColor = styleColor;

        // Group boxes
        this.userGroupBox.set_style(styleBorderColor);
        this.viewModeBox.set_style(styleBorderColor);
        this.powerGroupBox.set_style(styleBorderColor);
        this.preferencesGroupBox.set_style(styleBorderColor);

        // Scroll boxes
        this.shortcutsScrollBox.set_style(styleBorderColor);
        this.categoriesScrollBox.set_style(styleBorderColor);
        this.applicationsScrollBox.set_style(styleBackgroundColor);

        // Reset to user theme
        this.workspacesScrollBox.set_style(null);
        this.applicationsBoxWrapper.set_style(null);
    },

    _calculateApplicationsBoxWidth: function() {
        // Calculate visible menu boxes and adjust application scroll box width accordingly
        let minWidth = this.topPane.width - (this._widthCategoriesBox + this._widthShortcutsBox + this.workspacesWrapper.width);
        if (_DEBUG_) global.log("topPane width = "+this.topPane.width);
        if (_DEBUG_) global.log("shortcuts width = "+this.shortcutsScrollBox.width+" "+this._widthShortcutsBox);
        if (_DEBUG_) global.log("category width = "+this.categoriesScrollBox.width+" "+this._widthCategoriesBox);

        let gridBoxBorder = {left:0,top:0,bottom:0,right:0};
        let gridBoxPadding = {left:0,top:0,bottom:0,right:0};
        let buttonMargin = {left:0,top:0,bottom:0,right:0};
        let buttonBorder = {left:0,top:0,bottom:0,right:0};
        let buttonPadding = {left:0,top:0,bottom:0,right:0};
        if (this.applicationsGridBox.get_stage()) {
            let themeNode = this.applicationsGridBox.get_theme_node();
            gridBoxBorder = {
                left: themeNode.get_border_width(St.Side.LEFT),
                top: themeNode.get_border_width(St.Side.TOP),
                bottom: themeNode.get_border_width(St.Side.BOTTOM),
                right: themeNode.get_border_width(St.Side.RIGHT),
            };
            gridBoxPadding = {
                left: themeNode.get_padding(St.Side.LEFT),
                top: themeNode.get_padding(St.Side.TOP),
                bottom: themeNode.get_padding(St.Side.BOTTOM),
                right: themeNode.get_padding(St.Side.RIGHT),
            };

            let appType = ApplicationType.APPLICATION;
            let allAppCategoryButton = this.categoriesBox.get_child_at_index(0)._delegate;
            let allAppcategory = allAppCategoryButton._dir;
            let apps = this._listApplications(allAppcategory);
            if (apps) {
                let app = apps[0];
                let appGridButton = new AppGridButton(app, appType, true);
                let gridLayout = this.applicationsGridBox.layout_manager;
                gridLayout.pack(appGridButton.actor, 0, 0);
                if (appGridButton.actor.get_stage()) {
                    let themeNode = appGridButton.actor.get_theme_node();
                    buttonMargin = {
                        left: themeNode.get_margin(St.Side.LEFT),
                        top: themeNode.get_margin(St.Side.TOP),
                        bottom: themeNode.get_margin(St.Side.BOTTOM),
                        right: themeNode.get_margin(St.Side.RIGHT),
                    };
                    buttonBorder = {
                        left: themeNode.get_border_width(St.Side.LEFT),
                        top: themeNode.get_border_width(St.Side.TOP),
                        bottom: themeNode.get_border_width(St.Side.BOTTOM),
                        right: themeNode.get_border_width(St.Side.RIGHT),
                    };
                    buttonPadding = {
                        left: themeNode.get_padding(St.Side.LEFT),
                        top: themeNode.get_padding(St.Side.TOP),
                        bottom: themeNode.get_padding(St.Side.BOTTOM),
                        right: themeNode.get_padding(St.Side.RIGHT),
                    };

                    // calculate optimal App Grid button width
                    this._appGridButtonWidth = settings.get_int('apps-grid-label-width');
                    let tempSize = settings.get_int('apps-grid-icon-size');
                    if ( this._appGridButtonWidth < tempSize) {
                      this._appGridButtonWidth = tempSize;
                    }
                    tempSize = themeNode.get_min_width();
                    if ( this._appGridButtonWidth < tempSize) {
                      this._appGridButtonWidth = tempSize;
                    }

                    this._appGridButtonHeight = appGridButton.actor.height;

                    if (_DEBUG_) global.log("buttonWidth = "+this._appGridButtonWidth+" ["+settings.get_int('apps-grid-icon-size')+"]["+settings.get_int('apps-grid-label-width')+"]["+themeNode.get_min_width()+"]");
                }
            }
        }

        let scrollBoxBorder = {left:0,top:0,bottom:0,right:0};
        let scrollBoxPadding = {left:0,top:0,bottom:0,right:0};
        if (this.applicationsScrollBox.get_stage()) {
            let themeNode = this.applicationsScrollBox.get_theme_node();
            scrollBoxBorder = {
                left: themeNode.get_border_width(St.Side.LEFT),
                top: themeNode.get_border_width(St.Side.TOP),
                bottom: themeNode.get_border_width(St.Side.BOTTOM),
                right: themeNode.get_border_width(St.Side.RIGHT),
            };
            scrollBoxPadding = {
                left: themeNode.get_padding(St.Side.LEFT),
                top: themeNode.get_padding(St.Side.TOP),
                bottom: themeNode.get_padding(St.Side.BOTTOM),
                right: themeNode.get_padding(St.Side.RIGHT),
            };
        }

        let iconSize = this._appGridButtonWidth + buttonMargin.left + buttonMargin.right + buttonBorder.left + buttonBorder.right + buttonPadding.left + buttonPadding.right;
        if (_DEBUG_) global.log("icon size = "+iconSize +" ["+this._appGridButtonWidth+"]["+buttonMargin.left+"]["+buttonMargin.right+"]["+buttonBorder.left+"]["+buttonBorder.right+"]["+buttonPadding.left+"]["+buttonPadding.right+"]");
        let gridWidth = (iconSize * this._appGridColumns) + gridBoxBorder.left + gridBoxBorder.right + gridBoxPadding.left + gridBoxPadding.right;
        if (_DEBUG_) global.log("gridbox width = "+gridWidth+" ["+this._appGridColumns+"] ["+gridBoxBorder.left+"]["+gridBoxBorder.right+"]["+gridBoxPadding.left+"]["+gridBoxPadding.right+"]");
        let scrollWidth = gridWidth + scrollBoxBorder.left + scrollBoxBorder.right + scrollBoxPadding.left + scrollBoxPadding.right;

        if (_DEBUG_) global.log("scrollbox width = "+scrollWidth+" minWidth = "+minWidth +" ["+scrollBoxBorder.left+"]["+scrollBoxBorder.right+"]["+scrollBoxPadding.left+"]["+scrollBoxPadding.right+"]");
        if (scrollWidth >= minWidth) {
            this.applicationsScrollBox.width = scrollWidth;
        } else {
            this.applicationsScrollBox.width = minWidth;
            let extraWidth = minWidth - scrollWidth;
            if (_DEBUG_) global.log("EXPAND extra width = "+extraWidth);
            let gridLayout = this.applicationsGridBox.layout_manager;
            gridLayout.set_column_spacing(extraWidth / (this._appGridColumns-1));
        }

        this._clearApplicationsBox();
    },

    _resetDisplayApplicationsToStartup: function() {
        if (this._startupAppsView == StartupAppsDisplay.ALL) {
            // TODO: All apps hardcoded at category position 0
            let allAppCategoryButton = this.categoriesBox.get_child_at_index(0)._delegate;
            let allAppcategory = allAppCategoryButton._dir;
            this._clearApplicationsBox(allAppCategoryButton);
            this._displayApplications(this._listApplications(allAppcategory));
        } else if (this._startupAppsView == StartupAppsDisplay.FREQUENT) {
            // TODO: Frequent apps hardcoded at category position 1
            let freqAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
            let freqAppCategory = freqAppCategoryButton._dir;
            this._clearApplicationsBox(freqAppCategoryButton);
            this._displayApplications(this._listApplications(freqAppCategory));
        } else if (this._startupAppsView == StartupAppsDisplay.FAVORITES) {
            // TODO: Favorite apps hardcoded at category position 2
            let favAppCategoryButton = this.categoriesBox.get_child_at_index(2)._delegate;
            let favAppCategory = favAppCategoryButton._dir;
            this._clearApplicationsBox(favAppCategoryButton);
            this._displayApplications(this._listApplications(favAppCategory));
        } else if (this._startupAppsView == StartupAppsDisplay.RECENT) {
            let recent = this._listRecent();
            this._clearApplicationsBox();
            this._displayApplications(null, null, recent);
        } else if (this._startupAppsView == StartupAppsDisplay.WEBMARKS) {
            let webBookmarks = this._listWebBookmarks();
            this._clearApplicationsBox();
            this._displayApplications(null, webBookmarks);
        } else {
            this._clearApplicationsBox();
        }
    },

    _displayApplications: function(apps, places, recent, refresh) {
        let viewMode = this._applicationsViewMode;
        let appType;

        // variables for icon grid layout
        let page = 0;
        let column = 0;
        let rownum = 0;

        if (refresh) {
            apps = this._applications;
        } else {
            this._applications = [];
        }

        if (apps){
            appType = ApplicationType.APPLICATION;
            for (let i in apps) {
                let app = apps[i];
                // only add if not already in this._applications or refreshing
                if (refresh || !this._applications[app]) {
                    if (viewMode == ApplicationsViewMode.LIST) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appListButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appListButton._app.get_name());
                           if (appListButton._app.get_description()) this.selectedAppDescription.set_text(appListButton._app.get_description());
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appListButton._app.open_new_window(-1);
                           this.menu.close();
                        }));
                        this.applicationsListBox.add_actor(appListButton.actor);
                    } else { // GridView
                        let includeTextLabel = (settings.get_int('apps-grid-label-width') > 0) ? true : false;
                        let appGridButton = new AppGridButton(app, appType, includeTextLabel);
                        appGridButton.buttonbox.width = this._appGridButtonWidth;
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appGridButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appGridButton._app.get_name());
                           if (appGridButton._app.get_description()) this.selectedAppDescription.set_text(appGridButton._app.get_description());
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appGridButton._app.open_new_window(-1);
                           this.menu.close();
                        }));
                        let gridLayout = this.applicationsGridBox.layout_manager;
                        gridLayout.pack(appGridButton.actor, column, rownum);
                        column ++;
                        if (column > this._appGridColumns-1) {
                            column = 0;
                            rownum ++;
                        }
                    }
                }
                if (!refresh) this._applications[app] = app;
            }
        }


        if (refresh) {
            places = this._places;
        } else {
            this._places = [];
        }

        if (places){
            appType = ApplicationType.PLACE;
            for (let i in places) {
                let app = places[i];
                // only add if not already in this._places or refreshing
                if (refresh || !this._places[app.name]) {
                    if (viewMode == ApplicationsViewMode.LIST) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appListButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           if (app.uri) {
                               appListButton._app.app.launch_uris([app.uri], null);
                           } else {
                               appListButton._app.launch();
                           }
                           this.menu.close();
                        }));
                        this.applicationsListBox.add_actor(appListButton.actor);
                    } else { // GridView
                        let appGridButton = new AppGridButton(app, appType, true);
                        appGridButton.buttonbox.width = this._appGridButtonWidth;
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appGridButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appGridButton._app.name);
                           if (appGridButton._app.description) this.selectedAppDescription.set_text(appGridButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           if (app.uri) {
                               appGridButton._app.app.launch_uris([app.uri], null);
                           } else {
                               appGridButton._app.launch();
                           }
                           this.menu.close();
                        }));
                        let gridLayout = this.applicationsGridBox.layout_manager;
                        gridLayout.pack(appGridButton.actor, column, rownum);
                        column ++;
                        if (column > this._appGridColumns-1) {
                            column = 0;
                            rownum ++;
                        }
                    }
                }
                if (!refresh) this._places[app.name] = app;
            }
        }



        if (refresh) {
            recent = this._recent;
        } else {
            this._recent = [];
        }

        if (recent){
            appType = ApplicationType.RECENT;
            for (let i in recent) {
                let app = recent[i];
                // only add if not already in this._recent or refreshing
                if (refresh || !this._recent[app.name]) {
                    if (viewMode == ApplicationsViewMode.LIST) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appListButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                          appListButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context(0, -1));
                           this.menu.close();
                        }));
                        this.applicationsListBox.add_actor(appListButton.actor);
                    } else { // GridView
                        let appGridButton = new AppGridButton(app, appType, true);
                        appGridButton.buttonbox.width = this._appGridButtonWidth;
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                          appGridButton.actor.add_style_class_name('selected');
                           this.selectedAppTitle.set_text(appGridButton._app.name);
                           if (appGridButton._app.description) this.selectedAppDescription.set_text(appGridButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                          appGridButton.actor.remove_style_class_name('selected');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context(0, -1));
                           this.menu.close();
                        }));
                        let gridLayout = this.applicationsGridBox.layout_manager;
                        gridLayout.pack(appGridButton.actor, column, rownum);
                        column ++;
                        if (column > this._appGridColumns-1) {
                            column = 0;
                            rownum ++;
                        }
                    }
                }
                if (!refresh) this._recent[app.name] = app;
            }
        }

    },

    _scrollToActiveContainerButton: function(buttonActor) {
        let sBox;
        if (this._activeContainer == this.shortcutsBox) {
            sBox = this.shortcutsScrollBox;
        } else if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
            sBox = this.applicationsScrollBox;
        } else {
            return;
        }

        let vscroll = sBox.get_vscroll_bar();
        let buttonBox = buttonActor.get_allocation_box();

        var current_scroll_value = vscroll.get_adjustment().get_value();
        var box_height = sBox.get_allocation_box().y2-sBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;

        if (current_scroll_value > buttonBox.y1-20) new_scroll_value = buttonBox.y1-20;
        if (box_height+current_scroll_value < buttonBox.y2+20) new_scroll_value = buttonBox.y2-box_height+20;
        if (new_scroll_value!=current_scroll_value) vscroll.get_adjustment().set_value(new_scroll_value);
    },

    _onAplicationsScrolled: function(actor, event) {
        if (!this._appGridButtonHeight)
            return Clutter.EVENT_PROPAGATE;

        if (this._applicationsViewMode == ApplicationsViewMode.LIST)
            return Clutter.EVENT_PROPAGATE;

        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        let currentScrollValue = vscroll.get_adjustment().get_value();

        let newScrollValue = currentScrollValue;
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                newScrollValue = currentScrollValue - this._appGridButtonHeight;
                break;
            case Clutter.ScrollDirection.DOWN:
                newScrollValue = currentScrollValue + this._appGridButtonHeight;
                break;
        }

        if (newScrollValue != currentScrollValue)
            vscroll.get_adjustment().set_value(newScrollValue);

        return Clutter.EVENT_STOP;
    },

    _scrollToActiveThumbnail: function() {
        let thumbnail;
        let activeWorkspace = global.screen.get_active_workspace();
        for (let i = 0; i < this.thumbnailsBox._thumbnails.length; i++) {
            if (this.thumbnailsBox._thumbnails[i].metaWorkspace == activeWorkspace) {
                thumbnail = this.thumbnailsBox._thumbnails[i];
                break;
            }
        }

        if (thumbnail == null)
            return;

        // let [x, y] = thumbnail.actor.get_transformed_position();
        let [w, h] = thumbnail.actor.get_transformed_size();
        let [borderTop, borderBottom] = this.thumbnailsBox.getIndicatorBorders();

        let vscroll = this.workspacesScrollBox.get_vscroll_bar();

        var currentScrollValue = vscroll.get_adjustment().get_value();
        var scrollboxHeight = this.workspacesScrollBox.get_allocation_box().y2 - this.workspacesScrollBox.get_allocation_box().y1;

        var newScrollValue = currentScrollValue;
        if (currentScrollValue > thumbnail.actor.y - borderTop) {
            newScrollValue = thumbnail.actor.y - borderTop;
        }

        if (scrollboxHeight + currentScrollValue < thumbnail.actor.y + h + borderBottom) {
            newScrollValue = thumbnail.actor.y + h + borderBottom - scrollboxHeight;
        }

        vscroll.get_adjustment().set_value(newScrollValue);
    },

    _onWorkspacesScrolled: function(actor, event) {
        let activeWs = global.screen.get_active_workspace();
        let direction;

        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                direction = Meta.MotionDirection.UP;
                break;
            case Clutter.ScrollDirection.DOWN:
                direction = Meta.MotionDirection.DOWN;
                break;
        }

        if (direction) {
            let ws = activeWs.get_neighbor(direction);
            Main.wm.actionMoveWorkspace(ws);
            this._scrollToActiveThumbnail();
        }

        return Clutter.EVENT_STOP;
    },

    _validSearchKeyCode: function(keycode) {
        let valid = false;
        valid =
            (keycode > 47 && keycode < 58)   || // number keys
            keycode == 32 || keycode == 13   || // spacebar & return key(s) (if you want to allow carriage returns)
            (keycode > 64 && keycode < 91)   || // letter keys
            (keycode > 95 && keycode < 112)  || // numpad keys
            (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
            (keycode > 218 && keycode < 223);   // [\]' (in order)

        return valid;
    },

    _validNavigationKeyCode: function(symbol, code, modifiers) {
        let valid = false;
        valid =
            symbol == Clutter.KEY_Tab ||
            (code == 23 && (modifiers & Clutter.ModifierType.SHIFT_MASK)) ||
            symbol == Clutter.KEY_Left ||
            symbol == Clutter.KEY_Right ||
            symbol == Clutter.KEY_Up ||
            symbol == Clutter.KEY_Down ||
            symbol == Clutter.KEY_Shift_L ||
            symbol == Clutter.KEY_Shift_R ||
            symbol == Clutter.KEY_Alt_L ||
            symbol == Clutter.KEY_Alt_R ||
            symbol == Clutter.KEY_Page_Up ||
            symbol == Clutter.KEY_Page_Down ||
            symbol == Clutter.KEY_Control_L ||
            symbol == Clutter.KEY_Control_R ||
            symbol == Clutter.KEY_Search ||
            symbol == Clutter.KEY_Print ||
            symbol == Clutter.KEY_F1 ||
            symbol == Clutter.KEY_F2 ||
            symbol == Clutter.KEY_F3 ||
            symbol == Clutter.KEY_F4 ||
            symbol == Clutter.KEY_F5 ||
            symbol == Clutter.KEY_F6 ||
            symbol == Clutter.KEY_F7 ||
            symbol == Clutter.KEY_F8 ||
            symbol == Clutter.KEY_F9 ||
            symbol == Clutter.KEY_F10 ||
            symbol == Clutter.KEY_F11 ||
            symbol == Clutter.KEY_F12;

        return valid;
    },

    _onPanelMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let code = event.get_key_code();
        let modifiers = event.get_state();
        if (!this._validNavigationKeyCode(symbol, code, modifiers)) {
            let char = String.fromCharCode(symbol);
            this.searchEntry.set_text(char);
            this.searchEntry.grab_key_focus();
            return Clutter.EVENT_STOP;
        } else if (symbol == Clutter.KEY_Tab) {
            this.searchEntry.set_text("");
            this.searchEntry.grab_key_focus();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _onSearchKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let code = event.get_key_code();
        let modifiers = event.get_state();
        if (symbol == Clutter.KEY_Left || symbol == Clutter.KEY_Right) {
            this._onMenuKeyPress(actor, event);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let code = event.get_key_code();
        let modifiers = event.get_state();
        let shift = modifiers & Clutter.ModifierType.SHIFT_MASK;
        let viewMode = this._applicationsViewMode;

        this.menu.actor.grab_key_focus();
        if (!this._validNavigationKeyCode(symbol, code, modifiers)) {
            let char = String.fromCharCode(symbol);
            this.searchEntry.set_text(char);
            this.searchEntry.grab_key_focus();
            return Clutter.EVENT_STOP;
        }

        let reverse;
        if (code == 23 && shift)
            reverse = true;

        // Tab navigation
        if (code == 23) {
            if (this._activeContainer) {
                this._clearActiveContainerSelections();
            }
            switch (this._activeContainer) {
                case this.powerGroupBox:
                    if (reverse) {
                        this._activeContainer = this.thumbnailsBox;
                    } else {
                        if (settings.get_boolean('hide-useroptions')) {
                            this._activeContainer = this.viewModeBox;
                        } else {
                            this._activeContainer = this.userGroupBox;
                        }
                    }
                    break;
                case this.userGroupBox:
                    if (reverse) {
                        this._activeContainer = this.powerGroupBox;
                    } else {
                        this._activeContainer = this.viewModeBox;
                    }
                    break;
                case this.viewModeBox:
                    if (reverse) {
                        if (settings.get_boolean('hide-useroptions')) {
                            this._activeContainer = this.powerGroupBox;
                        } else {
                            this._activeContainer = this.userGroupBox;
                        }
                    } else {
                        this._activeContainer = this.searchEntry;
                        this.searchEntry.grab_key_focus();
                    }
                    break;
                case this.searchEntry:
                    if (reverse) {
                        this._activeContainer = this.viewModeBox;
                    } else {
                        this._activeContainer = this.preferencesGroupBox;
                    }
                    break;
                case this.preferencesGroupBox:
                    if (reverse) {
                        this._activeContainer = this.searchEntry;
                        this.searchEntry.grab_key_focus();
                    } else {
                        if (settings.get_boolean('hide-shortcuts')) {
                            if (settings.get_boolean('hide-categories')) {
                                this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
                            } else {
                                this._activeContainer = this.categoriesBox;
                            }
                        } else {
                            this._activeContainer = this.shortcutsBox;
                        }
                    }
                    break;
                case this.shortcutsBox:
                    if (reverse) {
                        this._activeContainer = this.preferencesGroupBox;
                    } else {
                        if (settings.get_boolean('hide-categories')) {
                            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
                        } else {
                            this._activeContainer = this.categoriesBox;
                        }
                    }
                    break;
                case this.categoriesBox:
                    if (reverse) {
                        if (settings.get_boolean('hide-shortcuts')) {
                            this._activeContainer = this.viewModeBox;
                        } else {
                            this._activeContainer = this.shortcutsBox;
                        }
                    } else {
                        this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
                    }
                    break;
                case this.applicationsListBox:
                    if (reverse) {
                        if (settings.get_boolean('hide-categories')) {
                            if (settings.get_boolean('hide-shortcuts')) {
                                this._activeContainer = this.viewModeBox;
                            } else {
                                this._activeContainer = this.shortcutsBox;
                            }
                        } else {
                            this._activeContainer = this.categoriesBox;
                        }
                    } else {
                        this._activeContainer = this.thumbnailsBox;
                    }
                    break;
                case this.applicationsGridBox:
                    if (reverse) {
                        if (settings.get_boolean('hide-categories')) {
                            if (settings.get_boolean('hide-shortcuts')) {
                                this._activeContainer = this.viewModeBox;
                            } else {
                                this._activeContainer = this.shortcutsBox;
                            }
                        } else {
                            this._activeContainer = this.categoriesBox;
                        }
                    } else {
                        this._activeContainer = this.thumbnailsBox;
                    }
                    break;
                case this.thumbnailsBox:
                    if (reverse) {
                        this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
                    } else {
                        this._activeContainer = this.powerGroupBox;
                    }
                    break;
                default:
                    if (reverse) {
                        this._activeContainer = this.viewModeBox;
                    } else {
                        this._activeContainer = this.preferencesGroupBox;
                    }
            }
            this._clearTabFocusSelections(this._activeContainer, true);
            this.selectActiveContainerItem(symbol, code);
            return true;
        }

        if (this._activeContainer == this.thumbnailsBox) {
            let direction;
            if (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Left) {
                direction = Meta.MotionDirection.UP;
            }
            if (symbol == Clutter.KEY_Down || symbol == Clutter.KEY_Right) {
                direction = Meta.MotionDirection.DOWN;
            }
            if (direction) {
                let activeWs = global.screen.get_active_workspace();
                let ws = activeWs.get_neighbor(direction);
                Main.wm.actionMoveWorkspace(ws);
                // this._clearTabFocusSelections(this._activeContainer, true);
                return true;
            }
        }

        // Set initial active container (default is this.applicationsListBox or this.applicationsGridBox)
        if (!this._activeContainer || this._activeContainer == this.searchEntry) {
            if (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Down) {
                this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
            }
            if (symbol == Clutter.KEY_Left || symbol == Clutter.KEY_Right) {
                this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
            }
        }

        if (this._activeContainer) {
            if (this.selectActiveContainerItem(symbol, code)) {
                return true;
            } else {
                this._clearActiveContainerSelections();
                return false;
            }
        } else {
            return false;
        }
    },

    selectActiveContainerItem: function(symbol, code, isFromSearch) {
        // Any items in container?
        let children = new Array();
        if (this._activeContainer.get_children) {
            children = this._activeContainer.get_children();
        }
        if (children.length==0){
            this._selectedItemIndex = -1;
        }

        // Get selected item index
        let index = this._selectedItemIndex;
        this._previousSelectedItemIndex = this._selectedItemIndex;

        // Navigate the active container
        if (symbol && symbol == Clutter.KEY_Up) {
            if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                index = 0;
            } else if (this._selectedItemIndex != null && this._selectedItemIndex > -1) {
                if (this._activeContainer == this.applicationsGridBox) {
                    var columns = this._appGridColumns;
                    index = (this._selectedItemIndex - columns < 0) ? this._selectedItemIndex : this._selectedItemIndex - columns;
                } else {
                    index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
                }
            }
        } else if (symbol && symbol == Clutter.KEY_Down) {
            if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                index = 0;
            } else {
                if (this._activeContainer == this.applicationsGridBox) {
                    var columns = this._appGridColumns;
                    index = (this._selectedItemIndex + columns >= children.length) ? this._selectedItemIndex : this._selectedItemIndex + columns;
                } else {
                    index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
                }
            }
        } else if (symbol && symbol == Clutter.KEY_Left) {
            if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                index = 0;
            } else if (this._selectedItemIndex != null && this._selectedItemIndex > 0) {
                if (this._activeContainer == this.applicationsGridBox) {
                    var columns = this._appGridColumns;
                    var row = Math.floor(this._selectedItemIndex/columns);
                    var firstCol = (row * columns);
                    index = (this._selectedItemIndex - 1 < firstCol) ? firstCol : this._selectedItemIndex - 1;
                } else {
                    index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
                }
            }
        } else if (symbol && symbol == Clutter.KEY_Right) {
            if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                index = 0;
            } else {
                if (this._activeContainer == this.applicationsGridBox) {
                    var columns = this._appGridColumns;
                    var row = Math.floor(this._selectedItemIndex/columns);
                    var lastCol = (row * columns) + columns;
                    lastCol = (lastCol > children.length) ? children.length : lastCol;
                    index = (this._selectedItemIndex + 1 >= lastCol) ? index : this._selectedItemIndex + 1;
                } else {
                    index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
                }
            }
        } else if (symbol && symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter) {
            if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox || this._activeContainer == this.shortcutsBox) {
                // Launch application or Nautilus place or Recent document
                let item_actor = children[this._selectedItemIndex];
                if (item_actor._delegate._type == ApplicationType.APPLICATION) {
                    this.menu.close();
                    item_actor._delegate._app.open_new_window(-1);
                } else if (item_actor._delegate._type == ApplicationType.PLACE) {
                    this.menu.close();
                    if (item_actor._delegate._app.uri) {
                       item_actor._delegate._app.app.launch_uris([item_actor._delegate._app.uri], null);
                    } else {
                       item_actor._delegate._app.launch();
                    }
                } else if (item_actor._delegate._type == ApplicationType.RECENT) {
                    this.menu.close();
                    Gio.app_info_launch_default_for_uri(item_actor._delegate._app.uri, global.create_app_launch_context(0, -1));
                }
                return true;
            } else if (this._activeContainer == this.userGroupBox || this._activeContainer == this.viewModeBox || this._activeContainer == this.powerGroupBox || this._activeContainer == this.categoriesBox) {
                // Simulate button click
                if (index>=children.length) {
                    return false;
                } else {
                    let item_actor = children[this._selectedItemIndex];
                    item_actor._delegate.click();
                }
                return true;
            } else {
                return false;
            }
        } else {
            if ((code && code == 23) || isFromSearch) {
                // Continue
                index = 0;
            } else {
                return false;
            }
        }

        // Check if position reached its end
        if (index>=children.length) {
            index = children.length-1;
        }

        // All good .. now get item actor in container
        this._selectedItemIndex = index;
        let itemActor = children[this._selectedItemIndex];

        // Check if item actor is valid
        if (!itemActor || itemActor === this.searchEntry) {
            return false;
        }

        // Clear out container and select item actor
        this._clearActiveContainerSelections(itemActor);

        // Set selected app name/description
        if (this._activeContainer == this.shortcutsBox || this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
            if (itemActor._delegate._type == ApplicationType.APPLICATION) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.get_name());
               if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.get_description());
               else this.selectedAppDescription.set_text("");
            } else if (itemActor._delegate._type == ApplicationType.PLACE) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.name);
               if (itemActor._delegate._app.description) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
               else this.selectedAppDescription.set_text("");
            } else if (itemActor._delegate._type == ApplicationType.RECENT) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.name);
               if (itemActor._delegate._app.description) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
               else this.selectedAppDescription.set_text("");
            }

            // Scroll to item actor if hidden from view
            this._scrollToActiveContainerButton(itemActor);
        }

        return true;
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
    },

    resetSearchWithFocus: function(){
        this.searchEntry.grab_key_focus();
        this.searchEntry.set_text("");
        this.searchActive = false;
    },

    _onSearchTextChanged: function (se, prop) {
        if (this.searchActive) {
            if (this.searchEntry.get_text() == "") {
                this._resetDisplayApplicationsToStartup();
            } else {
                this._clearCategorySelections(this.categoriesBox);
                this._clearUserGroupButtons();
            }
        }
        this._clearActiveContainerSelections();
        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");


        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {

            this.searchEntry.set_secondary_icon(this._searchActiveIcon);

            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, function() {
                    this.resetSearchWithFocus();
                    this._resetDisplayApplicationsToStartup();
                }));
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);

            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(null);
        }
        if (!this.searchActive) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;

        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },

    _doSearch: function(){
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        if (pattern==this._previousSearchPattern) return false;
        this._previousSearchPattern = pattern;

        this._activeContainer = null;
        this._selectedItemIndex = -1;
        this._previousSelectedItemIndex = null;
        this._clearTabFocusSelections();

        // _listApplications returns all the applications when the search
        // string is zero length. This will happend if you type a space
        // in the search entry.
        if (pattern.length == 0) {
            return false;
        }

        let appResults = this._listApplications(null, pattern);

        let placesResults = new Array();

        let places = this._listPlaces(pattern);
        for (var i in places) placesResults.push(places[i]);

        let webBookmarks = this._listWebBookmarks(pattern);
        for (var i in webBookmarks) placesResults.push(webBookmarks[i]);

        let recentResults = this._listRecent(pattern);


        this._clearApplicationsBox();
        this._displayApplications(appResults, placesResults, recentResults);

        this._activeContainer = (this._applicationsViewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
        this.selectActiveContainerItem(null, null, true);

        return false;
    },

    _display: function() {
        if (_DEBUG_) global.log("PanelMenuButton: _display");

        // popupMenuSection holds the mainbox
        let section = new PopupMenu.PopupMenuSection();
        this._dummySeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._dummySeparator.opacity = 0;
        this._dummyButton = new St.Button({style_class: 'button'});
        this._dummyButton.opacity = 0;
        this._dummyButton.set_size(0, 0);
        this._dummyButton2 = new St.Button({style_class: 'system-menu-action'});
        this._dummyButton2.opacity = 0;
        this._dummyButton2.set_size(0, 0);


        // mainbox holds the topPane and bottomPane
        this.mainBox = new St.BoxLayout({ name: 'gnomenuMenuMainbox', style_class: 'gnomenu-main-menu-box', vertical:true });

        // Top pane holds user group, view mode, and search (packed horizonally)
        this.topPane = new St.BoxLayout({ style_class: 'gnomenu-menu-top-pane' });

        // Middle pane holds shortcuts, categories/places/power, applications, workspaces (packed horizontally)
        let middlePane = new St.BoxLayout({ style_class: 'gnomenu-menu-middle-pane' });

        // Bottom pane holds power group and selected app description (packed horizontally)
        this.bottomPane = new St.BoxLayout({ style_class: 'gnomenu-menu-bottom-pane' });

        // categoriesWrapper bin wraps categories
        this.categoriesWrapper = new St.BoxLayout({ style_class: 'gnomenu-categories-workspaces-wrapper', vertical: false});

        // categoriesScrollBox allows categories or workspaces to scroll vertically
        this.categoriesScrollBox = new St.ScrollView({ reactive: true, x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'gnomenu-categories-workspaces-scrollbox' });
        let vscrollCategories = this.categoriesScrollBox.get_vscroll_bar();
        vscrollCategories.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscrollCategories.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));
        this.categoriesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.categoriesScrollBox.set_mouse_scrolling(true);

        // selectedAppBox
        this.selectedAppBox = new St.BoxLayout({ style_class: 'gnomenu-selected-app-box', vertical: false });
        this.selectedAppTitle = new St.Label({ style_class: 'gnomenu-selected-app-title', text: "" });
        this.selectedAppBox.add(this.selectedAppTitle, {expand: false, x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.selectedAppDescription = new St.Label({ style_class: 'gnomenu-selected-app-description', text: "" });
        this.selectedAppBox.add(this.selectedAppDescription, {expand: false, x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        // UserGroupBox
        this.userGroupBox = new St.BoxLayout({ style_class: 'gnomenu-user-group-box' });

        let userGroupButtonIconSize = 18;
        if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
            userGroupButtonIconSize = 16;

        // Create 'recent' category button
        this.recentCategory = new GroupButton( "folder-recent-symbolic", userGroupButtonIconSize, null, {style_class: 'gnomenu-user-group-button'});
        this.recentCategory.setButtonEnterCallback(Lang.bind(this, function() {
            this.recentCategory.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Recent'));
            this.selectedAppDescription.set_text('');
        }));
        this.recentCategory.setButtonLeaveCallback(Lang.bind(this, function() {
            this.recentCategory.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.recentCategory.setButtonPressCallback(Lang.bind(this, function() {
            this.recentCategory.actor.add_style_pseudo_class('pressed');
        }));
        this.recentCategory.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            this.recentCategory.actor.remove_style_pseudo_class('pressed');
            if (this.recentCategory._opened) {
                this.recentCategory._opened = false;
                this.webBookmarksCategory._opened = false;
                this._resetDisplayApplicationsToStartup();
            } else {
                this.recentCategory._opened = true;
                this.webBookmarksCategory._opened = false;
                this._selectRecent(this.recentCategory);
                this.selectedAppTitle.set_text(this.recentCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }
        }));

        // Create 'webBookmarks' category button
        this.webBookmarksCategory = new GroupButton( "web-browser-symbolic", userGroupButtonIconSize, null, {style_class: 'gnomenu-user-group-button'});
        this.webBookmarksCategory.setButtonEnterCallback(Lang.bind(this, function() {
            this.webBookmarksCategory.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('WebBookmarks'));
            this.selectedAppDescription.set_text('');
        }));
        this.webBookmarksCategory.setButtonLeaveCallback(Lang.bind(this, function() {
            this.webBookmarksCategory.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.webBookmarksCategory.setButtonPressCallback(Lang.bind(this, function() {
            this.webBookmarksCategory.actor.add_style_pseudo_class('pressed');
        }));
        this.webBookmarksCategory.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            this.webBookmarksCategory.actor.remove_style_pseudo_class('pressed');
            if (this.webBookmarksCategory._opened) {
                this.webBookmarksCategory._opened = false;
                this.recentCategory._opened = false;
                this._resetDisplayApplicationsToStartup();
            } else {
                this.webBookmarksCategory._opened = true;
                this.recentCategory._opened = false;
                this._selectWebBookmarks(this.webBookmarksCategory);
                this.selectedAppTitle.set_text(this.webBookmarksCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }
        }));

        this.userGroupBox.add(this.recentCategory.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(this.webBookmarksCategory.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        if (settings.get_boolean('hide-useroptions')) {
            this.userGroupBox.hide();
        }

        // ViewModeBox
        let viewModeButtonIcon = "view-grid-symbolic";
        if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
            viewModeButtonIcon = "view-list-symbolic";
        }

        let viewModeButtonIconSize = 18;
        if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
            viewModeButtonIconSize = 16;

        let viewModeAdditionalStyle = "";
        if (settings.get_boolean('hide-useroptions')) {
            viewModeAdditionalStyle = " no-useroptions";
        }

        this.viewModeBoxWrapper = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box-wrapper'+viewModeAdditionalStyle });
        this.viewModeBox = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box'+viewModeAdditionalStyle });

        this.toggleStartupAppsView = new GroupButton("view-toggle-apps-symbolic", viewModeButtonIconSize, null, {style_class: 'gnomenu-view-mode-button'});
        this.toggleStartupAppsView.setButtonEnterCallback(Lang.bind(this, function() {
            this.toggleStartupAppsView.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Toggle Startup Apps View'));
            this.selectedAppDescription.set_text('');
        }));
        this.toggleStartupAppsView.setButtonLeaveCallback(Lang.bind(this, function() {
            this.toggleStartupAppsView.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Toggle Startup Apps View'));
            this.selectedAppDescription.set_text('');
        }));
        this.toggleStartupAppsView.setButtonPressCallback(Lang.bind(this, function() {
            this.toggleStartupAppsView.actor.add_style_pseudo_class('pressed');
        }));
        this.toggleStartupAppsView.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            this.toggleStartupAppsView.actor.remove_style_pseudo_class('pressed');
            this.selectedAppTitle.set_text(_('Toggle Startup Apps View'));
            this.selectedAppDescription.set_text('');
            this._startupAppsView = this._startupAppsView + 1;
            if (this._startupAppsView > StartupAppsDisplay.FAVORITES) {
                this._startupAppsView = StartupAppsDisplay.ALL;
            }
            this._resetDisplayApplicationsToStartup();
        }));


        this.toggleListGridView = new GroupButton(viewModeButtonIcon, viewModeButtonIconSize, null, {style_class: 'gnomenu-view-mode-button'});
        this.toggleListGridView.setButtonEnterCallback(Lang.bind(this, function() {
            this.toggleListGridView.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('List-Grid View'));
            this.selectedAppDescription.set_text('');
        }));
        this.toggleListGridView.setButtonLeaveCallback(Lang.bind(this, function() {
            this.toggleListGridView.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.toggleListGridView.setButtonPressCallback(Lang.bind(this, function() {
            this.toggleListGridView.actor.add_style_pseudo_class('pressed');
        }));
        this.toggleListGridView.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            this.toggleListGridView.actor.remove_style_pseudo_class('pressed');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
                this.toggleListGridView.setIcon('view-list-symbolic');
                this._switchApplicationsView(ApplicationsViewMode.GRID);
            } else {
                this.toggleListGridView.setIcon('view-grid-symbolic');
                this._switchApplicationsView(ApplicationsViewMode.LIST);
            }
        }));

        this.viewModeBox.add(this.toggleStartupAppsView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBox.add(this.toggleListGridView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBoxWrapper.add(this.viewModeBox, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        // SearchBox
        let searchEntryAdditionalStyle = "";
        if (settings.get_int('apps-grid-icon-size') == 16) {
            searchEntryAdditionalStyle += " x16";
        } else if (settings.get_int('apps-grid-icon-size') == 22) {
            searchEntryAdditionalStyle += " x22";
        } else if (settings.get_int('apps-grid-icon-size') == 24) {
            searchEntryAdditionalStyle += " x24";
        } else if (settings.get_int('apps-grid-icon-size') == 32) {
            searchEntryAdditionalStyle += " x32";
        } else if (settings.get_int('apps-grid-icon-size') == 48) {
            searchEntryAdditionalStyle += " x48";
        } else if (settings.get_int('apps-grid-icon-size') == 64) {
            searchEntryAdditionalStyle += " x64";
        }
        if (settings.get_boolean('hide-useroptions')) {
            searchEntryAdditionalStyle += " no-useroptions";
        }

        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find-symbolic' });
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear-symbolic' });
        this.searchBox = new St.BoxLayout({ style_class: 'gnomenu-search-box'+searchEntryAdditionalStyle });
        this.searchEntry = new St.Entry({ name: 'gnomenuSearchEntry',
                                     style_class: 'search-entry gnomenu-search-entry'+searchEntryAdditionalStyle,
                                     hint_text: "",
                                     track_hover: true,
                                     can_focus: true });

        this.searchEntry.set_primary_icon(this._searchInactiveIcon);
        this.searchBox.add(this.searchEntry, {expand: true, x_align:St.Align.START, y_align:St.Align.START});
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onSearchKeyPress));
        this._previousSearchPattern = "";


        // ShortcutsBox
        this.shortcutsBox = new St.BoxLayout({ style_class: 'gnomenu-shortcuts-box', vertical: true });
        this.shortcutsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'gnomenu-shortcuts-scrollbox' });
        let vscrollShortcuts = this.shortcutsScrollBox.get_vscroll_bar();
        vscrollShortcuts.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscrollShortcuts.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.shortcutsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.shortcutsScrollBox.set_mouse_scrolling(true);

        if (settings.get_boolean('hide-shortcuts')) {
            this._widthShortcutsBox = 0;
            this.shortcutsScrollBox.hide();
        }

        //Load Favorites
        if (_DEBUG_) global.log("PanelMenuButton: _display - start loading favorites");
        this.favorites = [];
        let launchers = global.settings.get_strv('favorite-apps');
        for (let i = 0; i < launchers.length; ++i) {
            let app = Shell.AppSystem.get_default().lookup_app(launchers[i]);
            if (app)
                this.favorites.push(app);
        }
        if (_DEBUG_) global.log("PanelMenuButton: _display - end loading favorites");

        // Load Frequent Apps
        let mostUsed = Shell.AppUsage.get_default().get_most_used('');
        for (let i=0; i<mostUsed.length; i++) {
            if (mostUsed[i].get_app_info().should_show())
                this.frequentApps.push(mostUsed[i]);
        }

        // Load Places
        if (PlaceDisplay) {
            if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
                this.placesManager = new PlaceDisplay.PlacesManager(true);
            } else {
                this.placesManager = new PlaceDisplay.PlacesManager(false);
            }
            if (_DEBUG_) global.log("PanelMenuButton: _display - initialized PlacesManager")
        } else {
            this.placesManager = null;
            if (_DEBUG_) global.log("PanelMenuButton: _display - no PlacesManager")
        }

        // Load Shortcuts Panel
        let shortcuts = [];
        let shortcutType;
        if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
            let places = this._listPlaces();
            let bookmarks = this._listBookmarks();
            let devices = this._listDevices();
            let allPlaces = places.concat(bookmarks.concat(devices));
            shortcuts = allPlaces;
            shortcutType = ApplicationType.PLACE;
        } else {
            shortcuts = this.favorites;
            shortcutType = ApplicationType.APPLICATION;
        }
        for (let i = 0; i < shortcuts.length; ++i) {
            let app = shortcuts[i];
            let shortcutButton = new ShortcutButton(app, shortcutType);
            this.shortcutsBox.add_actor(shortcutButton.actor);
            shortcutButton.actor.connect('enter-event', Lang.bind(this, function() {
                shortcutButton.actor.add_style_class_name('selected');
                if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
                    this.selectedAppTitle.set_text(shortcutButton._app.name);
                    this.selectedAppDescription.set_text("");
                } else {
                    this.selectedAppTitle.set_text(shortcutButton._app.get_name());
                    if (shortcutButton._app.get_description()) this.selectedAppDescription.set_text(shortcutButton._app.get_description());
                    else this.selectedAppDescription.set_text("");
                }
            }));
            shortcutButton.actor.connect('leave-event', Lang.bind(this, function() {
                shortcutButton.actor.remove_style_class_name('selected');
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
            }));
            shortcutButton.actor.connect('button-press-event', Lang.bind(this, function() {
                shortcutButton.actor.add_style_pseudo_class('pressed');
            }));
            shortcutButton.actor.connect('button-release-event', Lang.bind(this, function() {
                shortcutButton.actor.remove_style_pseudo_class('pressed');
                shortcutButton.actor.remove_style_class_name('selected');
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
                if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
                    if (app.uri) {
                        shortcutButton._app.app.launch_uris([app.uri], null);
                    } else {
                        shortcutButton._app.launch();
                    }
                } else {
                    shortcutButton._app.open_new_window(-1);
                }
                this.menu.close();
            }));
        }

        // // Workspaces thumbnails Box and Wrapper
        this.thumbnailsBoxFiller = new St.BoxLayout({ style_class: 'gnomenu-workspaces-filler', vertical: true });
        this.thumbnailsBox = new WorkspaceThumbnail.myThumbnailsBox(gsVersion, settings, this.menu, this.thumbnailsBoxFiller);
        this.workspacesWrapper = new St.BoxLayout({ style_class: 'gnomenu-workspaces-wrapper' });
        this.workspacesWrapper.add(this.thumbnailsBoxFiller, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.workspacesWrapper.add(this.thumbnailsBox.actor, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});

        // workspacesScrollBox allows workspace thumbnails to scroll vertically
        this.workspacesScrollBox = new St.ScrollView({ reactive: true, x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'gnomenu-workspaces-scrollbox' });
        this.workspacesScrollBox.connect('scroll-event', Lang.bind(this, this._onWorkspacesScrolled));
        let vscrollWorkspaces = this.workspacesScrollBox.get_vscroll_bar();
        vscrollWorkspaces.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscrollWorkspaces.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));
        this.workspacesScrollBox.add_actor(this.workspacesWrapper);
        this.workspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.workspacesScrollBox.set_mouse_scrolling(true);

        // CategoriesBox
        this.categoriesBox = new St.BoxLayout({ style_class: 'gnomenu-categories-box', vertical: true });

        // Initialize application categories
        this.applicationsByCategory = {};

        // Load 'all applications' category
        let allAppCategory = new CategoryListButton('all', _('All Applications'), 'gnomenu-go-previous-symbolic');
        allAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
            allAppCategory.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(allAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');

            if (allAppCategory._ignoreHoverSelect)
                return;

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                let hoverDelay = settings.get_int('category-hover-delay');
                this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
                    this._selectCategory(allAppCategory);
                    this.menu.actor.grab_key_focus();
                    this._hoverTimeoutId = 0;
                }));
            }
        }));
        allAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
            allAppCategory.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                if (this._hoverTimeoutId > 0) {
                    Mainloop.source_remove(this._hoverTimeoutId);
                }
            }
        }));
        allAppCategory.setButtonPressCallback(Lang.bind(this, function() {
            allAppCategory.actor.add_style_pseudo_class('pressed');
        }));
        allAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            allAppCategory.actor.remove_style_pseudo_class('pressed');
            allAppCategory.actor.remove_style_class_name('selected');
            this._startupAppsView = StartupAppsDisplay.ALL;
            this._selectCategory(allAppCategory);
            this.selectedAppTitle.set_text(allAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.categoriesBox.add_actor(allAppCategory.actor);

        // Load 'frequent applications' category
        let freqAppCategory = new CategoryListButton('frequent', _('Frequent Apps'), 'gnomenu-go-previous-symbolic');
        freqAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
            freqAppCategory.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');

            if (freqAppCategory._ignoreHoverSelect)
                return;

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                let hoverDelay = settings.get_int('category-hover-delay');
                this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
                    this._selectCategory(freqAppCategory);
                    this.menu.actor.grab_key_focus();
                    this._hoverTimeoutId = 0;
                 }));
            }
        }));
        freqAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
            freqAppCategory.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                if (this._hoverTimeoutId > 0) {
                    Mainloop.source_remove(this._hoverTimeoutId);
                }
            }
        }));
        freqAppCategory.setButtonPressCallback(Lang.bind(this, function() {
            freqAppCategory.actor.add_style_pseudo_class('pressed');
        }));
        freqAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            freqAppCategory.actor.remove_style_pseudo_class('pressed');
            freqAppCategory.actor.remove_style_class_name('selected');
            this._startupAppsView = StartupAppsDisplay.FREQUENT;
            this._selectCategory(freqAppCategory);
            this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.categoriesBox.add_actor(freqAppCategory.actor);

        // Load 'favorite applications' category
        let favAppCategory = new CategoryListButton('favorites', _('Favorite Apps'), 'gnomenu-go-previous-symbolic');
        favAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
            favAppCategory.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(favAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');

            if (favAppCategory._ignoreHoverSelect)
                return;

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                let hoverDelay = settings.get_int('category-hover-delay');
                this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
                    this._selectCategory(favAppCategory);
                    this.menu.actor.grab_key_focus();
                    this._hoverTimeoutId = 0;
                }));
            }
        }));
        favAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
            favAppCategory.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');

            if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                if (this._hoverTimeoutId > 0) {
                    Mainloop.source_remove(this._hoverTimeoutId);
                }
            }
        }));
        favAppCategory.setButtonPressCallback(Lang.bind(this, function() {
            favAppCategory.actor.add_style_pseudo_class('pressed');
        }));
        favAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
            this.menu.actor.grab_key_focus();
            favAppCategory.actor.remove_style_pseudo_class('pressed');
            favAppCategory.actor.remove_style_class_name('selected');
            this._startupAppsView = StartupAppsDisplay.FAVORITES;
            this._selectCategory(favAppCategory);
            this.selectedAppTitle.set_text(favAppCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.categoriesBox.add_actor(favAppCategory.actor);

        // Load rest of categories
        if (_DEBUG_) global.log("PanelMenuButton: _display - start loading categories");
        let tree = new GMenu.Tree({ menu_basename: 'applications.menu' });
        tree.load_sync();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                this.applicationsByCategory[dir.get_menu_id()] = [];
                this._loadCategories(dir);
                if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                    let appCategory = new CategoryListButton(dir, null, 'gnomenu-go-previous-symbolic');
                    appCategory.setButtonEnterCallback(Lang.bind(this, function() {
                        appCategory.actor.add_style_class_name('selected');
                        this.selectedAppTitle.set_text(appCategory.label.get_text());
                        this.selectedAppDescription.set_text('');

                        if (appCategory._ignoreHoverSelect)
                            return;

                        if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                            let hoverDelay = settings.get_int('category-hover-delay');
                            this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
                                this._selectCategory(appCategory);
                                this.menu.actor.grab_key_focus();
                                this._hoverTimeoutId = 0;
                            }));
                        }
                    }));
                    appCategory.setButtonLeaveCallback(Lang.bind(this, function() {
                        appCategory.actor.remove_style_class_name('selected');
                        this.selectedAppTitle.set_text('');
                        this.selectedAppDescription.set_text('');

                        if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
                            if (this._hoverTimeoutId > 0) {
                                Mainloop.source_remove(this._hoverTimeoutId);
                            }
                        }
                    }));
                    appCategory.setButtonPressCallback(Lang.bind(this, function() {
                        appCategory.actor.add_style_pseudo_class('pressed');
                    }));
                    appCategory.setButtonReleaseCallback(Lang.bind(this, function() {
                        this.menu.actor.grab_key_focus();
                        appCategory.actor.remove_style_pseudo_class('pressed');
                        appCategory.actor.remove_style_class_name('selected');
                        this._selectCategory(appCategory);
                        this.selectedAppTitle.set_text(appCategory.label.get_text());
                        this.selectedAppDescription.set_text('');
                    }));
                    this.categoriesBox.add_actor(appCategory.actor);
                }
            }
        }
        if (_DEBUG_) global.log("PanelMenuButton: _display - end loading categories");

        // PowerGroupBox
        this.powerGroupBox = new St.BoxLayout({ style_class: 'gnomenu-power-group-box'});
        let powerGroupButtonIconSize = 18;
        if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
            powerGroupButtonIconSize = 16;

        this.systemRestart = new GroupButton('refresh-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        this.systemRestart.setButtonEnterCallback(Lang.bind(this, function() {
            this.systemRestart.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Restart Shell'));
            this.selectedAppDescription.set_text('');
        }));
        this.systemRestart.setButtonLeaveCallback(Lang.bind(this, function() {
            this.systemRestart.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.systemRestart.setButtonPressCallback(Lang.bind(this, function() {
            this.systemRestart.actor.add_style_pseudo_class('pressed');
        }));
        this.systemRestart.setButtonReleaseCallback(Lang.bind(this, function() {
            // code to refresh shell
            this.systemRestart.actor.remove_style_pseudo_class('pressed');
            this.systemRestart.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            global.reexec_self();
        }));
        this.systemSuspend = new GroupButton('suspend-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        this.systemSuspend.setButtonEnterCallback(Lang.bind(this, function() {
            this.systemSuspend.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Suspend'));
            this.selectedAppDescription.set_text('');
        }));
        this.systemSuspend.setButtonLeaveCallback(Lang.bind(this, function() {
            this.systemSuspend.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.systemSuspend.setButtonPressCallback(Lang.bind(this, function() {
            this.systemSuspend.actor.add_style_pseudo_class('pressed');
        }));
        this.systemSuspend.setButtonReleaseCallback(Lang.bind(this, function() {
            // code to suspend
            this.systemSuspend.actor.remove_style_pseudo_class('pressed');
            this.systemSuspend.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();

            //NOTE: alternate is to check if (Main.panel.statusArea.userMenu._haveSuspend) is true
            let loginManager = LoginManager.getLoginManager();
            loginManager.canSuspend(Lang.bind(this,
                function(result) {
                    if (result) {
                        Main.overview.hide();
                        loginManager.suspend();
                    }
            }));
        }));
        this.systemShutdown = new GroupButton('shutdown-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        this.systemShutdown.setButtonEnterCallback(Lang.bind(this, function() {
            this.systemShutdown.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Shutdown'));
            this.selectedAppDescription.set_text('');
        }));
        this.systemShutdown.setButtonLeaveCallback(Lang.bind(this, function() {
            this.systemShutdown.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.systemShutdown.setButtonPressCallback(Lang.bind(this, function() {
            this.systemShutdown.actor.add_style_pseudo_class('pressed');
        }));
        this.systemShutdown.setButtonReleaseCallback(Lang.bind(this, function() {
            // code to shutdown (power off)
            // ToDo: GS38 itterates through SystemLoginSession to check for open sessions
            // and displays an openSessionWarnDialog
            this.systemShutdown.actor.remove_style_pseudo_class('pressed');
            this.systemShutdown.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.ShutdownRemote();
        }));
        this.logoutUser = new GroupButton('user-logout-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        this.logoutUser.setButtonEnterCallback(Lang.bind(this, function() {
            this.logoutUser.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Logout User'));
            this.selectedAppDescription.set_text('');
        }));
        this.logoutUser.setButtonLeaveCallback(Lang.bind(this, function() {
            this.logoutUser.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.logoutUser.setButtonPressCallback(Lang.bind(this, function() {
            this.logoutUser.actor.add_style_pseudo_class('pressed');
        }));
        this.logoutUser.setButtonReleaseCallback(Lang.bind(this, function() {
            // code to logout user
            this.logoutUser.actor.remove_style_pseudo_class('pressed');
            this.logoutUser.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.LogoutRemote(0);
        }));
        this.lockScreen = new GroupButton('user-lock-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        this.lockScreen.setButtonEnterCallback(Lang.bind(this, function() {
            this.lockScreen.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Lock Screen'));
            this.selectedAppDescription.set_text('');
        }));
        this.lockScreen.setButtonLeaveCallback(Lang.bind(this, function() {
            this.lockScreen.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.lockScreen.setButtonPressCallback(Lang.bind(this, function() {
            this.lockScreen.actor.add_style_pseudo_class('pressed');
        }));
        this.lockScreen.setButtonReleaseCallback(Lang.bind(this, function() {
            // code for lock options
            this.lockScreen.actor.remove_style_pseudo_class('pressed');
            this.lockScreen.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            Main.overview.hide();
            Main.screenShield.lock(true);
        }));

        this.powerGroupBox.add(this.systemRestart.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(this.systemSuspend.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(this.systemShutdown.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(this.logoutUser.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(this.lockScreen.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        // ApplicationsBox (ListView / GridView)
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade gnomenu-applications-scrollbox' });
        this.applicationsScrollBox.connect('scroll-event', Lang.bind(this, this._onAplicationsScrolled));
        let vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        vscrollApplications.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscrollApplications.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));

        this.applicationsListBox = new St.BoxLayout({ style_class: 'gnomenu-applications-list-box', vertical:true, x_expand:true});
        this.applicationsGridBox = new St.Widget({ layout_manager: new Clutter.TableLayout(), reactive:true, style_class: 'gnomenu-applications-grid-box'});
        this.applicationsBoxWrapper = new St.BoxLayout({ style_class: 'gnomenu-applications-box-wrapper' });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.applicationsBoxWrapper.add(this.applicationsListBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_mouse_scrolling(true);


        // Extension Preferences
        this.preferencesGroupBox = new St.BoxLayout({ style_class: 'gnomenu-preferences-group-box'});
        let preferencesGroupButtonIconSize = 18;
        if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
            preferencesGroupButtonIconSize = 16;

        this.extensionPreferences = new GroupButton('control-center-alt-symbolic', preferencesGroupButtonIconSize, null, {style_class: 'gnomenu-preferences-group-button'});
        this.extensionPreferences.setButtonEnterCallback(Lang.bind(this, function() {
            this.extensionPreferences.actor.add_style_class_name('selected');
            this.selectedAppTitle.set_text(_('Preferences'));
            this.selectedAppDescription.set_text('');
        }));
        this.extensionPreferences.setButtonLeaveCallback(Lang.bind(this, function() {
            this.extensionPreferences.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.extensionPreferences.setButtonPressCallback(Lang.bind(this, function() {
            this.extensionPreferences.actor.add_style_pseudo_class('pressed');
        }));
        this.extensionPreferences.setButtonReleaseCallback(Lang.bind(this, function() {
            // code to show extension preferences
            this.extensionPreferences.actor.remove_style_pseudo_class('pressed');
            this.extensionPreferences.actor.remove_style_class_name('selected');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            Main.Util.trySpawnCommandLine(PREFS_DIALOG);
            this.menu.close();
        }));
        this.preferencesGroupBox.add(this.extensionPreferences.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});


        // Place boxes in proper containers. The order added determines position
        // ----------------------------------------------------------------------

        // topPane packs horizontally
        this.topPane.add(this.powerGroupBox);
        this.topPane.add(this.userGroupBox);
        this.topPane.add(this.viewModeBoxWrapper, {x_align:St.Align.START, y_align:St.Align.MIDDLE});
        this.topPane.add(this.searchBox, {expand: true, x_align:St.Align.END, y_align:St.Align.MIDDLE});

        this.categoriesWrapper.add(this.categoriesBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.categoriesScrollBox.add_actor(this.categoriesWrapper);

        if (settings.get_boolean('hide-categories')) {
            this._widthCategoriesBox = 0;
            this.categoriesBox.hide();
            this.categoriesWrapper.hide();
            this.categoriesScrollBox.hide();
        }

        // middlePane packs horizontally
        middlePane.add(this.shortcutsScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        middlePane.add(this.categoriesScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        middlePane.add(this.applicationsScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        middlePane.add(this.workspacesScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});

        // bottomPane packs horizontally
        let bottomPaneSpacer1 = new St.Label({text: '', style_class: 'gnomenu-spacer'});
        this.bottomPane.add(this._dummyButton);
        this.bottomPane.add(this._dummyButton2);
        this.bottomPane.add(bottomPaneSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.bottomPane.add(this.selectedAppBox, {expand: false, x_align:St.Align.END, y_align:St.Align.MIDDLE});

        let bShowPreferences = true;
        try {
            let pattern = settings.get_string('show-settings-to').trim();
            if (pattern == "NONE")
                bShowPreferences = false;
            else if (pattern != "ALL") {
                let [result, unixGroups, stderr, errorLevel] = GLib.spawn_command_line_sync('id -Gn');
                if ( !errorLevel ) {
                    unixGroups = " "+unixGroups.toString().trim()+" ";
                    bShowPreferences = unixGroups.toLowerCase().indexOf(" "+pattern.toLowerCase()+" ") != -1
                }
            }
        } catch (err) {
            global.log(err.message.toString());
        }
        if (bShowPreferences) {
            this.topPane.add(this.preferencesGroupBox, {x_fill:false, y_fill: false, x_align:St.Align.END, y_align:St.Align.MIDDLE});
        }


        // mainbox packs vertically
        this.mainBox.add_actor(this.topPane);
        this.mainBox.add_actor(middlePane);
        this.mainBox.add_actor(this.bottomPane);

        // add all to section
        section.actor.add_actor(this.mainBox);

        // add section as menu item
        this.menu.addMenuItem(section);
        this.menu.addMenuItem(this._dummySeparator);

        // Set height constraints on scrollboxes (we also set height when menu toggle)
        this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({name: 'appScrollBoxConstraint', source: this.categoriesScrollBox, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));
        this.shortcutsScrollBox.add_constraint(new Clutter.BindConstraint({name: 'shortcutsScrollBoxConstraint', source: this.categoriesScrollBox, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));
    }

});




/* =========================================================================
/* name:    GnoMenuButton
 * @desc    The main panel object that holds view/apps/menu buttons
 * ========================================================================= */

const GnoMenuButton = new Lang.Class({
    Name: 'GnoMenu.GnoMenuPanelButton',

    _init: function() {

        // Connect theme context for when theme changes
        this._themeChangedId = St.ThemeContext.get_for_stage(global.stage).connect('changed', Lang.bind(this, this._onStyleChanged));

        // Connect gtk icontheme for when icons change
        this._iconsChangedId = IconTheme.get_default().connect('changed', Lang.bind(this, this._onIconsChanged));

        // Connect to AppSys for when new application installed
        this._installedChangedId = Shell.AppSystem.get_default().connect('installed-changed', Lang.bind(this, this._onAppInstalledChanged));

        // Connect to AppFavorites for when favorites change
        this._favoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._onFavoritesChanged));

        // Connect to Main.overview for when overview mode showing or hiding
        this._overviewShownId = Main.overview.connect('shown', Lang.bind(this, this._onOverviewShown));
        this._overviewHiddenId = Main.overview.connect('hidden', Lang.bind(this, this._onOverviewHidden));
        this._overviewPageChangedId = Main.overview.viewSelector.connect('page-changed', Lang.bind(this, this._onOverviewPageChanged));

        // Bind Preference Settings
        this._bindSettingsChanges();

        // Initialize GnoMenuButton actor
        this.actor = new St.BoxLayout({ name: 'gnomenuPanelBox', style_class: 'gnomenu-panel-box' });

        this._setHotSpotTimeoutId = 0;
        this._display();

    },

    updateCornerPanel() {
        if (Main.panel.actor.get_text_direction() == Clutter.TextDirection.RTL) {
            Main.panel._leftCorner.setStyleParent(Main.panel._rightBox);
            Main.panel._rightCorner.setStyleParent(Main.panel._leftBox);
        } else {
            Main.panel._leftCorner.setStyleParent(Main.panel._leftBox);
            Main.panel._rightCorner.setStyleParent(Main.panel._rightBox);
        }
    },

    refresh: function() {
        if (_DEBUG_) global.log("GnoMenuButton: refresh");
        this._clearAll();
        this._display();
        this.updateCornerPanel();
    },

    _clearAll: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _clearAll");
        if (this._hotCorner) this.actor.remove_actor(this._hotCorner.actor);
        if (this._hotCorner) this._hotCorner.destroy();
        this._hotCorner = null;
        if (_DEBUG_) global.log("GnoMenuButton: _clearAll removed and destroyed hotcorner from gnomenubutton actor");

        if (this.viewButton) this.actor.remove_actor(this.viewButton.container);
        if (this.appsButton) this.actor.remove_actor(this.appsButton.container);
        if (this.appsMenuButton) this.actor.remove_actor(this.appsMenuButton.container);

        if (_DEBUG_) global.log("GnoMenuButton: _clearAll removed panel buttons from gnomenubutton actor");

        if (this.viewButton) this.viewButton.actor.destroy();
        this.viewButton = null;
        if (_DEBUG_) global.log("GnoMenuButton: _clearAll destroyed view button");

        if (this.appsButton) this.appsButton.actor.destroy();
        this.appsButton = null;
        if (_DEBUG_) global.log("GnoMenuButton: _clearAll destroyed apps button");

        if (this.appsMenuButton) {
            // Unbind menu accelerator key
            Main.wm.removeKeybinding('panel-menu-keyboard-accelerator');
            this.appsMenuButton.destroy();
        }
        this.appsMenuButton = null;
        if (_DEBUG_) global.log("GnoMenuButton: _clearAll destroyed menu button");
    },

    _display: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _display");
        // Initialize view button
        if (!settings.get_boolean('hide-panel-view')) {
            let viewLabel = settings.get_strv('panel-view-label-text')[0];
            let viewIcon = null;
            if (settings.get_boolean('use-panel-view-icon')) {
                viewIcon = settings.get_strv('panel-view-icon-name')[0];
            }
            this.viewButton = new PanelButton(viewLabel, viewIcon);
            this.viewButton.actor.connect('button-release-event', Lang.bind(this, this._onViewButtonRelease));
        }
        if (_DEBUG_) global.log("GnoMenuButton: _display initialized view button");

        // Initialize apps button
        if (!settings.get_boolean('hide-panel-apps')) {
            let appsLabel = settings.get_strv('panel-apps-label-text')[0];
            let appsIcon = null;
            if (settings.get_boolean('use-panel-apps-icon')) {
                appsIcon = settings.get_strv('panel-apps-icon-name')[0];
            }
            this.appsButton = new PanelButton(appsLabel, appsIcon);
            this.appsButton.actor.connect('button-release-event', Lang.bind(this, this._onAppsButtonRelease));
        }
        if (_DEBUG_) global.log("GnoMenuButton: _display initialized apps button");

        // Initialize apps menu button
        if (!settings.get_boolean('hide-panel-menu')) {
            this.appsMenuButton = new PanelMenuButton();
            if (_DEBUG_) global.log("GnoMenuButton: _display initialized menu button");

            // Bind menu accelerator key
            if (!settings.get_boolean('disable-panel-menu-keyboard')) {
                Main.wm.addKeybinding('panel-menu-keyboard-accelerator', settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL | Shell.ActionMode.POPUP,
                    Lang.bind(this, function() {
                        if (this.appsMenuButton)
                            this.appsMenuButton.menu.toggle();
                    })
                );
            }
        }

        // Add buttons to GnoMenuButton actor
        if (settings.get_enum('panel-menu-position') == MenuButtonPosition.LEFT)
            if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);

        if (this.viewButton) this.actor.add(this.viewButton.container);

        if (settings.get_enum('panel-menu-position') == MenuButtonPosition.CENTER)
            if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);

        if (this.appsButton) this.actor.add(this.appsButton.container);

        if (settings.get_enum('panel-menu-position') == MenuButtonPosition.RIGHT)
            if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);

        // if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);
        if (_DEBUG_) global.log("GnoMenuButton: _display added buttons to gnomenubutton actor");

        // Disable or Enable Hot Corner
        if (settings.get_boolean('disable-activities-hotcorner')) {
            if (_DEBUG_) global.log("GnoMenuButton: _display disabled hot corner");
            let primary = Main.layoutManager.primaryIndex;
            let corner = Main.layoutManager.hotCorners[primary];
            if (corner && corner.actor) {
                // This is GS 3.8+ fallback corner. Need to hide actor
                // to keep from triggering overview
                corner.actor.hide();
            } else {
                // Need to destroy corner to remove pressure barrier
                // to keep from triggering overview
                if (corner && corner._pressureBarrier) {
                    Main.layoutManager.hotCorners.splice(primary, 1);
                    corner.destroy();
                }
            }
        } else {
            if (_DEBUG_) global.log("GnoMenuButton: _display enabled hot corner");
            let primary = Main.layoutManager.primaryIndex;
            let corner = Main.layoutManager.hotCorners[primary];
            if (corner && corner.actor) {
                // This is Gs 3.8+ fallback corner. Need to show actor
                // to trigger overview
                corner.actor.show();
            } else {
                // Need to create corner to setup pressure barrier
                // to trigger overview
                if (corner && corner._pressureBarrier) {
                    if (_DEBUG_) global.log("GnoMenuButton: _display corner & pressureBarrier exist ");
                } else {
                    if (_DEBUG_) global.log("GnoMenuButton: _display corner & pressureBarrier don't exist - updateHotCorners");
                    Main.layoutManager._updateHotCorners();
                }
            }
        }

        // Add menu to panel menu manager
        if (this.appsMenuButton) Main.panel.menuManager.addMenu(this.appsMenuButton.menu);
    },

    // handler for when view panel button clicked
    _onViewButtonRelease: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onViewButtonRelease");
        if (Main.overview.visible) {
            if (!Main.overview.viewSelector._showAppsButton.checked) {
                Main.overview.hide();
                Main.overview.viewSelector._showAppsButton.checked = false;
                // this.viewButton.actor.remove_style_pseudo_class('active');
            } else {
                Main.overview.viewSelector._showAppsButton.checked = false;
                // this.viewButton.actor.add_style_pseudo_class('active');
            }
        } else {
            // this.viewButton.actor.add_style_pseudo_class('active');
            Main.overview.show();
        }
    },

    // handler for when apps panel button clicked
    _onAppsButtonRelease: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onAppsButtonRelease");
        if (Main.overview.visible) {
            if (Main.overview.viewSelector._showAppsButton.checked) {
                Main.overview.hide();
                Main.overview.viewSelector._showAppsButton.checked = false;
                // this.appsButton.actor.remove_style_pseudo_class('active');
            } else {
                Main.overview.viewSelector._showAppsButton.checked = true;
                // this.appsButton.actor.add_style_pseudo_class('active');
            }
        } else {
            Main.overview.show();
            Main.overview.viewSelector._showAppsButton.checked = true;
            // this.appsButton.actor.add_style_pseudo_class('active');
        }
    },

    _onOverviewShown: function() {
        if (Main.overview.viewSelector._activePage == Main.overview.viewSelector._appsPage) {
            if (this.appsButton) {
                this.appsButton.actor.add_style_pseudo_class('active');
            }
            if (this.viewButton) {
                this.viewButton.actor.remove_style_pseudo_class('active');
            }
        } else {
            if (this.appsButton) {
                this.appsButton.actor.remove_style_pseudo_class('active');
            }
            if (this.viewButton) {
                this.viewButton.actor.add_style_pseudo_class('active');
            }
        }
    },

    _onOverviewHidden: function() {
        if (this.appsButton)
            this.appsButton.actor.remove_style_pseudo_class('active');

        if (this.viewButton)
            this.viewButton.actor.remove_style_pseudo_class('active');
    },

    _onOverviewPageChanged: function() {
        if (Main.overview.viewSelector._activePage == Main.overview.viewSelector._appsPage) {
            if (this.appsButton) {
                this.appsButton.actor.add_style_pseudo_class('active');
            }
            if (this.viewButton) {
                this.viewButton.actor.remove_style_pseudo_class('active');
            }
        } else {
            if (this.appsButton) {
                this.appsButton.actor.remove_style_pseudo_class('active');
            }
            if (this.viewButton) {
                this.viewButton.actor.add_style_pseudo_class('active');
            }
        }
    },

    // function called during init to position hot corner for GS 3.4-GS3.6
    _positionHotCorner: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _positionHotCorner");
        // The hot corner needs to be outside any padding/alignment
        // that has been imposed on us
        let primary = Main.layoutManager.primaryMonitor;
        let hotBox = new Clutter.ActorBox();
        let ok, x, y;
        if (this.actor.get_text_direction() == Clutter.TextDirection.LTR) {
            [ok, x, y] = this.actor.transform_stage_point(primary.x, primary.y)
        } else {
            [ok, x, y] = this.actor.transform_stage_point(primary.x + primary.width, primary.y);
            // hotCorner.actor has northeast gravity, so we don't need
            // to adjust x for its width
        }

        hotBox.x1 = Math.round(x);
        hotBox.x2 = hotBox.x1 + this._hotCorner.actor.width;
        hotBox.y1 = Math.round(y);
        hotBox.y2 = hotBox.y1 + this._hotCorner.actor.height;

        this._hotCorner.actor.set_position(hotBox.x1, hotBox.y1);
        this._hotCorner.actor.set_size(hotBox.x2-hotBox.x1, hotBox.y2-hotBox.y1);
    },

    // handler for when theme changes
    _onStyleChanged: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onStyleChanged");
        let ret = this._changeStylesheet();
        //if (ret) {
            //if (this.appsMenuButton) this.appsMenuButton.actor.grab_key_focus();
            //if (this.viewButton) this.viewButton.actor.grab_key_focus();
            //if (this.appsButton) this.appsButton.actor.grab_key_focus();
            //if (this.actor) this.actor.grab_key_focus();
            //global.stage.set_key_focus(null);
        //}
    },

    _changeStylesheet: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet");
        // Get menu layout
        let ml = "-m";
        if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
            ml = "-s";

        // Get css filename
        let filename = "gnomenu" + ml + ".css";

        // Get new theme stylesheet
        let themeStylesheet = Main._defaultCssStylesheet;
        if (Main._cssStylesheet != null)
            themeStylesheet = Main._cssStylesheet;

        // Get theme directory
        let themeDirectory = themeStylesheet.get_path() ? GLib.path_get_dirname(themeStylesheet.get_path()) : "";
        if (_DEBUG_) global.log("GnoMenuButton: _changedStylesheet new theme = "+themeStylesheet);

        // Test for gnomenu stylesheet
        let newStylesheet = null;
        if (themeDirectory != "")
            newStylesheet = Gio.file_new_for_path(themeDirectory + '/extensions/gno-menu/' + filename);

        if (!newStylesheet || !newStylesheet.query_exists(null)) {
            if (_DEBUG_) global.log("GnoMenuButton: _chengeStylesheet Theme doesn't support gnomenu .. use default stylesheet");
            let defaultStylesheet = Gio.File.new_for_path(Me.path + "/themes/default/" + filename);
            if (defaultStylesheet.query_exists(null)) {
                newStylesheet = defaultStylesheet;
            } else {
                throw new Error(_("No GnoMenu stylesheet found") + " (extension.js).");
            }
        }

        if (GnoMenuStylesheet && GnoMenuStylesheet.equal(newStylesheet)) {
            if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet No change in stylesheet. Exit");
            return false;
        }

        // Change gnomenu stylesheet by updating theme
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        if (!themeContext)
            return false;

        if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet themeContext is valid");
        let theme = themeContext.get_theme();
        if (!theme)
            return false;

        if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet theme is valid");
        let customStylesheets = theme.get_custom_stylesheets();
        if (!customStylesheets)
            return false;

        let previousStylesheet = GnoMenuStylesheet;
        GnoMenuStylesheet = newStylesheet;

        let newTheme = new St.Theme ({ application_stylesheet: themeStylesheet });
        for (let i = 0; i < customStylesheets.length; i++) {
            if (!customStylesheets[i].equal(previousStylesheet)) {
                newTheme.load_stylesheet(customStylesheets[i]);
            }
        }

        if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet Removed previous stylesheet");
        newTheme.load_stylesheet(GnoMenuStylesheet);
        if (_DEBUG_) global.log("GnoMenuButton: _changeStylesheet Added new stylesheet");
        themeContext.set_theme (newTheme);
        if (this.appsMenuButton) this.appsMenuButton.refresh();

        return true;
    },

    // handler for when new application installed
    _onAppInstalledChanged: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onAppInstalledChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // handler for when favorites change
    _onFavoritesChanged: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onFavoritesChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // handler for when icons change
    _onIconsChanged: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _onIconsChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // function to bind preference setting changes
    _bindSettingsChanges: function() {
        if (_DEBUG_) global.log("GnoMenuButton: _bindSettingsChanges");
        settings.connect('changed::hide-panel-view', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-activities-hotcorner', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-view-label-text', Lang.bind(this, this.refresh));
        settings.connect('changed::use-panel-view-icon', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-view-icon-name', Lang.bind(this, this.refresh));
        settings.connect('changed::hide-panel-apps', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-apps-label-text', Lang.bind(this, this.refresh));
        settings.connect('changed::use-panel-apps-icon', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-apps-icon-name', Lang.bind(this, this.refresh));
        settings.connect('changed::hide-panel-menu', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-menu-keyboard', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-menu-label-text', Lang.bind(this, this.refresh));
        settings.connect('changed::use-panel-menu-icon', Lang.bind(this, this.refresh));
        settings.connect('changed::hide-panel-menu-arrow', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-menu-icon-name', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-menu-hotspot', Lang.bind(this, this.refresh));
        settings.connect('changed::panel-menu-position', Lang.bind(this, this.refresh));

        settings.connect('changed::category-selection-method', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::shortcuts-display', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::shortcuts-icon-size', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::menu-layout', Lang.bind(this, function() {
            let ret = this._changeStylesheet();
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::hide-useroptions', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::hide-shortcuts', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::hide-categories', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::apps-grid-column-count', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::hide-workspaces', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
    },

    // function to destroy GnoMenuButton
    destroy: function() {
        // Disconnect global signals
        if (this._installedChangedId)
            Shell.AppSystem.get_default().disconnect(this._installedChangedId);

        if (this._favoritesChangedId)
            AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);

        if (this._iconsChangedId)
            IconTheme.get_default().disconnect(this._iconsChangedId);

        if (this._themeChangedId)
            St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);

        if (this._overviewShownId)
            Main.overview.disconnect(this._overviewShownId);

        if (this._overviewHiddenId)
            Main.overview.disconnect(this._overviewHiddenId);

        if (this._overviewPageChangedId)
            Main.overview.disconnect(this._overviewPageChangedId);

        // Unbind menu accelerator key
        Main.wm.removeKeybinding('panel-menu-keyboard-accelerator');

        // Destroy main clutter actor: this should be sufficient
        // From clutter documentation:
        // If the actor is inside a container, the actor will be removed.
        // When you destroy a container, its children will be destroyed as well.
        this.actor.destroy();
    }

});



function loadStylesheet() {
    if (_DEBUG_) global.log("GnoMenu Extension: loadStylesheet");
    // Get menu layout
    let ml = "-m";
    if (settings.get_enum('menu-layout') == MenuLayout.COMPACT)
        ml = "-s";

    // Get css filename
    let filename = "gnomenu" + ml + ".css";

    // Get current theme stylesheet
    let themeStylesheet = Main._getDefaultStylesheet();
    if (Main.getThemeStylesheet() != null)
        themeStylesheet = Main.getThemeStylesheet();

    // Get theme directory
    let themeDirectory = themeStylesheet.get_path() ? GLib.path_get_dirname(themeStylesheet.get_path()) : "";

    // Test for gnomenu stylesheet
    if (themeDirectory != "")
        GnoMenuStylesheet = Gio.file_new_for_path(themeDirectory + '/extensions/gno-menu/' + filename);

    if (!GnoMenuStylesheet || !GnoMenuStylesheet.query_exists(null)) {
        if (_DEBUG_) global.log("GnoMenu Extension: Theme doesn't support gnomenu .. use default stylesheet");
        let defaultStylesheet = Gio.File.new_for_path(Me.path + "/themes/default/" + filename);
        if (defaultStylesheet.query_exists(null)) {
            GnoMenuStylesheet = defaultStylesheet;
        } else {
            throw new Error(_("No GnoMenu stylesheet found") + " (extension.js).");
        }
    }

    let themeContext = St.ThemeContext.get_for_stage(global.stage);
    if (!themeContext)
        return false;

    let theme = themeContext.get_theme();
    if (!theme)
        return false;

    // Load gnomenu stylesheet
    theme.load_stylesheet(GnoMenuStylesheet);
    return true;
}

function unloadStylesheet() {
    if (_DEBUG_) global.log("GnoMenu Extension: unloadStylesheet");
    let themeContext = St.ThemeContext.get_for_stage(global.stage);
    if (!themeContext)
        return false;

    let theme = themeContext.get_theme();
    if (!theme)
        return false;

    // Unload gnomenu stylesheet
    if (GnoMenuStylesheet)
        theme.unload_stylesheet(GnoMenuStylesheet);

    GnoMenuStylesheet = null;
    return true;
}


/* =========================================================================
/* Extension Enable & Disable
 * =========================================================================*/

let GnoMenu;
let hideDefaultActivitiesButton = true;
let GnoMenuStylesheet = null;

function enable() {

    if (_DEBUG_) global.log("GnoMenu Extension: ENABLE");
    // Load stylesheet
    loadStylesheet();

    // Remove default Activities Button
    if (hideDefaultActivitiesButton) {
        let button = Main.panel.statusArea['activities'];
        if (button != null) {
            button.actor.hide();
        }
    }

    // Add GnoMenu to panel
    GnoMenu = new GnoMenuButton();
    Main.panel.statusArea['gnomenubutton'] = GnoMenu;
    Main.panel._leftBox.insert_child_at_index(GnoMenu.actor, 0);
    GnoMenu.updateCornerPanel();
}

function disable() {

    if (_DEBUG_) global.log("GnoMenu Extension: DISABLE");
    // Unload stylesheet
    unloadStylesheet();

    //Restore default Activities Button
    if (hideDefaultActivitiesButton) {
        let button = Main.panel.statusArea['activities'];
        if (button) {
            button.actor.show();
        }
    }

    // Destroy GnoMenu
    GnoMenu.destroy();
    GnoMenu = null;
}

function init() {
    Convenience.initTranslations();

    // Add extension icons to icon theme directory path
    // TODO: move this to enable/disable?
    // GS patch https://bugzilla.gnome.org/show_bug.cgi?id=675561
    let theme = IconTheme.get_default();
    theme.append_search_path(Me.path + "/icons");
}
