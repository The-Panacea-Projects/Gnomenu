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
    FAVORITES: 2
};

const SelectMethod = {
    HOVER: 0,
    CLICK: 1
};

const MenuLayout = {
    LARGE: 0,
    MEDIUM: 1,
    SMALL: 2
};

const ApplicationType = {
    APPLICATION: 0,
    PLACE: 1,
    RECENT: 2
};

const CategoryWorkspaceMode = {
    CATEGORY: 0,
    WORKSPACE: 1
};

const ApplicationsViewMode = {
    LIST: 0,
    GRID: 1
};


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
        let style = "popup-menu-item popup-submenu-menu-item gnomenu-category-button";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.START, y_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        let iconSize = 28;

        this._dir = dir;
        let categoryNameText = "";
        let categoryIconName = null;

        if (typeof dir == 'string') {
            categoryNameText = altNameText;
            categoryIconName = altIconName;
        } else {
            categoryNameText = dir.get_name() ? dir.get_name() : "";
            categoryIconName = dir.get_icon() ? dir.get_icon().get_names().toString() : "error";
        }

        //if (categoryIconName) {
        //    this.icon = new St.Icon({icon_name: categoryIconName, icon_size: iconSize});
        //    this.buttonbox.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        //}
        this.label = new St.Label({ text: categoryNameText, style_class: 'gnomenu-category-button-label' });
        this.buttonbox.add(this.label, {x_fill: false, y_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);
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

        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
                if (GnoMenu.appsMenuButton) {
                    if (GnoMenu.appsMenuButton._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY)
                        GnoMenu.appsMenuButton.toggleCategoryWorkspaceMode();
                }
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
        this.actor.remove_style_pseudo_class('active');

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

        this.buttonbox = new St.BoxLayout();
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.buttonbox.add(this.label, {x_fill: false, y_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);

        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
                if (GnoMenu.appsMenuButton) {
                    if (GnoMenu.appsMenuButton._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY)
                        GnoMenu.appsMenuButton.toggleCategoryWorkspaceMode();
                }
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
        this.actor.remove_style_pseudo_class('active');

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
        let style = "popup-menu-item gnomenu-application-grid-button";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        this.actor._delegate = this;
        this._iconSize = (settings.get_int('apps-grid-icon-size') > 0) ? settings.get_int('apps-grid-icon-size') : 64;

        // appType 0 = application, appType 1 = place, appType 2 = recent
        if (appType == ApplicationType.APPLICATION) {
            this.icon = app.create_icon_texture(this._iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == ApplicationType.PLACE) {
            this.icon = new St.Icon({gicon: app.icon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == ApplicationType.RECENT) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: this._iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: this._iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-grid-button-label' });
        }

        this.buttonbox = new St.BoxLayout({vertical: true});
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
        if(includeText){
            // Use pango to wrap label text
            //this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
            //this.label.clutter_text.line_wrap = true;
            this.buttonbox.add(this.label, {x_fill: false, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        this.actor.set_child(this.buttonbox);

        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this,
            function () {
                //this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
                if (GnoMenu.appsMenuButton) {
                    if (GnoMenu.appsMenuButton._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY)
                        GnoMenu.appsMenuButton.toggleCategoryWorkspaceMode();
                }
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
        this.actor.remove_style_pseudo_class('active');

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
        let style = "popup-menu-item popup-submenu-menu-item";
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor.add_style_class_name(params.style_class);

        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout({vertical: true});

        if (iconName && iconSize) {
            //this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize, icon_type: St.IconType.SYMBOLIC});
            this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize});
            this.buttonbox.add(this.icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        if (labelText) {
            this.label = new St.Label({ text: labelText, style_class: params.style_class+'-label' });
            // Use pango to wrap label text
            //this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
            //this.label.clutter_text.line_wrap = true;
            this.buttonbox.add(this.label, {x_fill: false, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.START});
        }
        this.actor.set_child(this.buttonbox);
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
            nameText = ' '+nameText;
        }

        // Add label to button
        let label = new St.Label({ text: nameText});
        let labelWrapper = new St.Bin();
        labelWrapper.set_child(label);
        this._box.add(labelWrapper, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
    },

    // Override _onStyleChanged function
    _onStyleChanged: function(actor) {
        // Ignore HPadding
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

        this.actor.add_style_class_name('panel-status-button');
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
        let label = new St.Label({ text: ' '+labelText});
        let labelWrapper = new St.Bin();
        labelWrapper.set_child(label);
        this._box.add(labelWrapper, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));

        this.applicationsByCategory = {};
        this.favorites = [];
        this.frequentApps = [];
        this._applications = [];
        this._places = [];
        this._recent = [];

        this._applicationsViewMode = settings.get_enum('startup-view-mode');
        this._appGridColumns = 5;
        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;
        this._categoryWorkspaceMode = CategoryWorkspaceMode.CATEGORY;

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

    // handler for when PanelMenuButton hotspot entered
    _onHotSpotEntered: function() {
        if (_DEBUG_) global.log("PanelMenuButton: _onHotSpotEntered");
        if (!this.menu.isOpen) {
            this.menu.toggle();
        }
    },

    // Override _onStyleChanged function
    _onStyleChanged: function(actor) {
        // Ignore HPadding
    },

    _onOpenStateToggled: function(menu, open) {
        if (open) {
            //// Setting the max-height won't do any good if the minimum height of the
            //// menu is higher then the screen; it's useful if part of the menu is
            //// scrollable so the minimum height is smaller than the natural height
            //let monitor = Main.layoutManager.primaryMonitor;
            //this.menu.actor.style = ('max-height: ' +
                            //Math.round(monitor.height - Main.panel.actor.height) +
                            //'px;');


            // SANITY CHECK - verify hotspot location --------
            //let [x, y] = this.actor.get_transformed_position();
            //let [w, h] = this.actor.get_size();
            //x = Math.floor(x);
            //w = Math.floor(w);
            //global.log("PanelMenuButton: _onOpenStateToggled x="+x+"  w="+w);
            // -----------------------------------------------

            // Set focus to search entry
            global.stage.set_key_focus(this.searchEntry);

            // Fixes issue in GS 3.8 where search entry is not focused
            // for some reason, GS 3.8 steals the focus back
            if (this._menuToggleTimeoutId > 0)
                Mainloop.source_remove(this._menuToggleTimeoutId);

            this._menuToggleTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, this.resetSearch));

            // Load Startup Applications category
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._resetDisplayApplicationsToStartup();

            // Set height (we also set constraints on scrollboxes
            // Why does height need to be set when already set constraints? because of issue noted below
            // ISSUE: If height isn't set, then popup menu height will expand when application buttons are added
            let height = this.groupCategoriesWorkspacesScrollBox.height;
            this.applicationsScrollBox.height = height;
            this.shortcutsScrollBox.height = height;
            this.thumbnailsBox._createThumbnails();
            this.thumbnailsBox.actor.set_position(1, 0); // position inside wrapper


            // Set Category or Workspace Mode
            // Currently we force category mode when menu is toggled
            this._categoryWorkspaceMode = CategoryWorkspaceMode.CATEGORY;
            this.thumbnailsBox.actor.hide();
            this.thumbnailsBoxFiller.width = 0;
            this.thumbnailsBoxFiller.height = 0;
            this.categoriesBox.show();
            this._widthCategoriesBox = 0;
            this.recentCategory._opened = false;
            this.webBookmarksCategory._opened = false;
            this.placesCategory._opened = false;

            // Adjust width of categories box and thumbnails box depending on if shortcuts are shown
            // Determine width based on user-power group button widths
            if (settings.get_boolean('hide-shortcuts')) {
                if (this.userGroupBox.width > this.groupCategoriesWorkspacesScrollBox.width) {
                    let categoryWidth = this.userGroupBox.width;
                    this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
                    this.categoriesBox.width = categoryWidth;
                    this._widthCategoriesBox = categoryWidth;
                    this.thumbnailsBox.actor.width = categoryWidth;
                    this.thumbnailsBox._actualThumbnailWidth = categoryWidth;
                } else {
                    let groupWidth = this.groupCategoriesWorkspacesScrollBox.width;
                    this.userGroupBox.width = groupWidth;
                    this.categoriesBox.width = this.groupCategoriesWorkspacesScrollBox.width;
                    this._widthCategoriesBox = this.groupCategoriesWorkspacesScrollBox.width;
                    this.thumbnailsBox.actor.width = this.groupCategoriesWorkspacesScrollBox.width;
                    this.thumbnailsBox._actualThumbnailWidth = this.groupCategoriesWorkspacesScrollBox.width;
                }
            } else {
                if (this.powerGroupBox.width > (this.groupCategoriesWorkspacesScrollBox.width + this.shortcutsScrollBox.width)) {
                    if (_DEBUG_) global.log("PanelMenuButton: _onOpenStateToggled - powerGroup width > categories-shortcuts");
                    this.userGroupBox.width = this.powerGroupBox.width;
                    let categoryWidth = this.powerGroupBox.width - this.shortcutsScrollBox.width;
                    this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
                    this.categoriesBox.width = categoryWidth;
                    this._widthCategoriesBox = categoryWidth;
                    this.thumbnailsBox.actor.width = categoryWidth;
                    this.thumbnailsBox._actualThumbnailWidth = categoryWidth;
                } else {
                    if (_DEBUG_) global.log("PanelMenuButton: _onOpenStateToggled - powerGroup width < categories-shortcuts");
                    let groupWidth = this.groupCategoriesWorkspacesScrollBox.width + this.shortcutsScrollBox.width;
                    this.powerGroupBox.width = groupWidth;
                    this.userGroupBox.width = groupWidth;
                    this.categoriesBox.width = this.groupCategoriesWorkspacesScrollBox.width;
                    this._widthCategoriesBox = this.groupCategoriesWorkspacesScrollBox.width;
                    this.thumbnailsBox.actor.width = this.groupCategoriesWorkspacesScrollBox.width;
                    this.thumbnailsBox._actualThumbnailWidth = this.groupCategoriesWorkspacesScrollBox.width;
                }
            }
        } else {
            this.resetSearch();
            this._clearCategorySelections(this.categoriesBox);
            this._clearUserGroupButtons();
            this._clearApplicationSelections();
            this._clearApplicationsBox();
            global.stage.set_key_focus(null);

            if (this._menuToggleTimeoutId > 0)
                Mainloop.source_remove(this._menuToggleTimeoutId);

            this.thumbnailsBox._destroyThumbnails();
        }
    },

    refresh: function() {
        this._clearAll();
        this._display();
    },

    _clearAll: function() {
        this.menu.removeAll();
    },

    toggleCategoryWorkspaceMode: function(mode) {
        let toMode = null;
        if (mode != undefined) {
            toMode = mode;
        } else {
            if (this._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY) {
                toMode = CategoryWorkspaceMode.WORKSPACE;
            } else {
                toMode = CategoryWorkspaceMode.CATEGORY;
            }
        }
        if (toMode == CategoryWorkspaceMode.CATEGORY){
            this._categoryWorkspaceMode = CategoryWorkspaceMode.CATEGORY;
            this.thumbnailsBox.actor.hide();
            //this.thumbnailsBoxFiller.width = 0;
            this.thumbnailsBoxFiller.height = 0;
            this.categoriesBox.width = this._widthCategoriesBox;
            this.categoriesBox.show();
            if (_DEBUG_) global.log("PanelMenuButton: _toggleCategoryWorkspaceMode - categoryPlaces height = "+this.categoriesBox.height+" scrollbox height = "+this.groupCategoriesWorkspacesScrollBox.height);
        } else if (toMode == CategoryWorkspaceMode.WORKSPACE) {
            this._categoryWorkspaceMode = CategoryWorkspaceMode.WORKSPACE;
            if (this._widthCategoriesBox == 0) {
                this._widthCategoriesBox = this.categoriesBox.width;
            }
            this.categoriesBox.hide();
            this.categoriesBox.width = 0;

            this.thumbnailsBox.actor.show();
            //this.thumbnailsBoxFiller.width = this.categoriesBox.width;
            this.thumbnailsBoxFiller.height = this.thumbnailsBox.actor.height;
            if (_DEBUG_) global.log("PanelMenuButton: _toggleCategoryWorkspaceMode - thumbnailsBox height = "+this.thumbnailsBox.actor.height+" scrollbox height = "+this.groupCategoriesWorkspacesScrollBox.height);
        }
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

        this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.WORKSPACE);
    },

    _selectAllPlaces: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let places = this._listPlaces();
        let bookmarks = this._listBookmarks();
        let devices = this._listDevices();

        let allPlaces = places.concat(bookmarks.concat(devices));
        this._displayApplications(null, allPlaces);

        this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.WORKSPACE);
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

        this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.WORKSPACE);
    },

    _selectWebBookmarks: function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let webBookmarks = this._listWebBookmarks();
        this._displayApplications(null, webBookmarks);

        this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.WORKSPACE);
    },

    _switchApplicationsView: function(mode) {
        this._applicationsViewMode = mode;
        let refresh = true;

        // switch activeContainer and reset _selectedItemIndex for keyboard navigation
        if (this._activeContainer == null || this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {

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
                    actor.add_style_pseudo_class('active');
                    actor.add_style_pseudo_class('open');
                    //actor.add_style_class_name("gnomenu-category-button-selected");
                } else {
                    actor.remove_style_pseudo_class('active');
                    actor.remove_style_pseudo_class('open');
                    //actor.remove_style_class_name("gnomenu-category-button-selected");
                }
            }
        }
    },

    _clearUserGroupButtons: function() {
        this.recentCategory.actor.remove_style_pseudo_class('open');
        this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
        this.placesCategory.actor.remove_style_pseudo_class('open');
        this.recentCategory._opened = false;
        this.webBookmarksCategory._opened = false;
        this.placesCategory._opened = false;
    },

    _clearApplicationSelections: function(selectedApplication) {
        this.applicationsListBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_pseudo_class('active');
                actor.add_style_pseudo_class('open');
                //actor.add_style_class_name("gnomenu-application-button-selected");
            } else {
                actor.remove_style_pseudo_class('active');
                actor.remove_style_pseudo_class('open');
                //actor.remove_style_class_name("gnomenu-application-button-selected");
            }
        });

        this.applicationsGridBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_pseudo_class('active');
                actor.add_style_pseudo_class('open');
                //actor.add_style_class_name("gnomenu-application-grid-button-selected");
            } else {
                actor.remove_style_pseudo_class('active');
                actor.remove_style_pseudo_class('open');
                //actor.remove_style_class_name("gnomenu-application-grid-button-selected");
            }
        });
    },

    _clearApplicationsBox: function(selectedCategory, refresh){
        this._selectedItemIndex = -1;
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
                    //actor.add_style_pseudo_class('active');
                    actor.add_style_pseudo_class('open');
                    //actor.add_style_class_name("gnomenu-category-button-selected");
                } else {
                    //actor.remove_style_pseudo_class('active');
                    actor.remove_style_pseudo_class('open');
                    //actor.remove_style_class_name("gnomenu-category-button-selected");
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
                Main.notify(
                    _("Gno-Menu: Search Firefox bookmarks disabled"),
                    _("If you want to search Firefox bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 (Ubuntu) or libgda-sqlite (Fedora)")
                );
            }
            if (!Midori.Gda) {
                Main.notify(
                    _("Gno-Menu: Search Midori bookmarks disabled"),
                    _("If you want to search Midori bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 (Ubuntu) or libgda-sqlite (Fedora)")
                );
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
                if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1))
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

    _resetDisplayApplicationsToStartup: function() {
        if (settings.get_enum('startup-apps-display') == StartupAppsDisplay.FAVORITES) {
            this._clearApplicationsBox();
            this._displayApplications(this._listApplications('favorites'));
        } else if (settings.get_enum('startup-apps-display') == StartupAppsDisplay.FREQUENT) {
            // TODO: Frequent apps hardcoded at category position 0
            let freqAppCategoryButton = this.categoriesBox.get_child_at_index(0)._delegate;
            let freqAppCategory = freqAppCategoryButton._dir;
            this._clearApplicationsBox(freqAppCategoryButton);
            this._displayApplications(this._listApplications(freqAppCategory));
        } else {
            // TODO: All apps hardcoded at category position 1
            let allAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
            let allAppcategory = allAppCategoryButton._dir;
            this._clearApplicationsBox(allAppCategoryButton);
            this._displayApplications(this._listApplications(allAppcategory));
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
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.get_name());
                           if (appListButton._app.get_description()) this.selectedAppDescription.set_text(appListButton._app.get_description());
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appListButton.actor.has_style_pseudo_class('open')) appListButton.actor.remove_style_pseudo_class('active');
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appListButton._app.open_new_window(-1);
                           this.menu.close();
                        }));
                        this.applicationsListBox.add_actor(appListButton.actor);
                    } else { // GridView
                        let appGridButton = new AppGridButton(app, appType, true);
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appGridButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appGridButton._app.get_name());
                           if (appGridButton._app.get_description()) this.selectedAppDescription.set_text(appGridButton._app.get_description());
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appGridButton.actor.has_style_pseudo_class('open')) appGridButton.actor.remove_style_pseudo_class('active');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appGridButton._app.open_new_window(-1);
                           this.menu.close();
                        }));
                        this.applicationsGridBox.add(appGridButton.actor, {row:rownum, col:column, x_fill:false, y_fill:false, x_expand:false, y_expand: false, x_align:St.Align.START, y_align:St.Align.START});
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
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appListButton.actor.has_style_pseudo_class('open')) appListButton.actor.remove_style_pseudo_class('active');
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                           appListButton.actor.remove_style_pseudo_class('active');
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
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appGridButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appGridButton._app.name);
                           if (appGridButton._app.description) this.selectedAppDescription.set_text(appGridButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appGridButton.actor.has_style_pseudo_class('open')) appGridButton.actor.remove_style_pseudo_class('active');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           if (app.uri) {
                               appGridButton._app.app.launch_uris([app.uri], null);
                           } else {
                               appGridButton._app.launch();
                           }
                           this.menu.close();
                        }));
                        this.applicationsGridBox.add(appGridButton.actor, {row:rownum, col:column, x_fill:false, y_fill:false, x_expand:false, y_expand: false, x_align:St.Align.START, y_align:St.Align.START});
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
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appListButton.actor.has_style_pseudo_class('open')) appListButton.actor.remove_style_pseudo_class('active');
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appListButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('pressed');
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context(0, -1));
                           this.menu.close();
                        }));
                        this.applicationsListBox.add_actor(appListButton.actor);
                    } else { // GridView
                        let appGridButton = new AppGridButton(app, appType, true);
                        appGridButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appGridButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appGridButton._app.name);
                           if (appGridButton._app.description) this.selectedAppDescription.set_text(appGridButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('leave-event', Lang.bind(this, function() {
                           //if (!appGridButton.actor.has_style_pseudo_class('open')) appGridButton.actor.remove_style_pseudo_class('active');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-press-event', Lang.bind(this, function() {
                            appGridButton.actor.add_style_pseudo_class('pressed');
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('pressed');
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context(0, -1));
                           this.menu.close();
                        }));
                        this.applicationsGridBox.add(appGridButton.actor, {row:rownum, col:column, x_fill:false, y_fill:false, x_expand:false, y_expand: false, x_align:St.Align.START, y_align:St.Align.START});
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

    _scrollToApplicationButton: function(buttonActor) {
        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        let buttonBox = buttonActor.get_allocation_box();

        var current_scroll_value = vscroll.get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;

        if (current_scroll_value > buttonBox.y1-20) new_scroll_value = buttonBox.y1-20;
        if (box_height+current_scroll_value < buttonBox.y2+20) new_scroll_value = buttonBox.y2-box_height+20;
        if (new_scroll_value!=current_scroll_value) vscroll.get_adjustment().set_value(new_scroll_value);
    },

    _onMenuKeyPress: function(actor, event) {

        let symbol = event.get_key_symbol();
        let viewMode = this._applicationsViewMode;

        // Set initial active container (default is this.applicationsListBox or this.applicationsGridBox)
        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Left) {
            this._activeContainer = this.categoriesBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Right) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
        }

        // Any items in container?
        let children = this._activeContainer.get_children();
        if (children.length==0){
            this._selectedItemIndex = -1;
        }

        // Get selected item index
        let index = this._selectedItemIndex;
        this._previousSelectedItemIndex = this._selectedItemIndex;

        // Navigate the applicationsListBox/applicationsGridBox containers
        if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
                if (symbol == Clutter.KEY_Up) {
                    if (this._selectedItemIndex != null && this._selectedItemIndex > -1) {
                        if (viewMode == ApplicationsViewMode.LIST) {
                            index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
                        } else {
                            var columns = this._appGridColumns;
                            index = (this._selectedItemIndex - columns < 0) ? this._selectedItemIndex : this._selectedItemIndex - columns;
                        }
                    }
                } else if (symbol == Clutter.KEY_Down) {
                    if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                        index = 0;
                    } else {
                        if (viewMode == ApplicationsViewMode.LIST) {
                            index = (this._selectedItemIndex + 1 == children.length) ? children.length - 1 : this._selectedItemIndex + 1;
                        } else {
                            var columns = this._appGridColumns;
                            index = (this._selectedItemIndex + columns >= children.length) ? this._selectedItemIndex : this._selectedItemIndex + columns;
                        }
                    }
                } else if (symbol == Clutter.KEY_Left) {
                    if (this._selectedItemIndex != null && this._selectedItemIndex > 0) {
                        if (viewMode == ApplicationsViewMode.LIST) {
                            // Move to categoriesBox

                        } else {
                            var columns = this._appGridColumns;
                            var row = Math.floor(this._selectedItemIndex/columns);
                            var firstCol = (row * columns);
                            index = (this._selectedItemIndex - 1 < firstCol) ? firstCol : this._selectedItemIndex - 1;
                        }
                    }
                } else if (symbol == Clutter.KEY_Right) {
                    if (this._selectedItemIndex == null || this._selectedItemIndex < 0) {
                        index = 0;
                    } else {
                        if (viewMode == ApplicationsViewMode.LIST) {
                            // Do nothing
                        } else {
                            var columns = this._appGridColumns;
                            var row = Math.floor(this._selectedItemIndex/columns);
                            var lastCol = (row * columns) + columns;
                            lastCol = (lastCol > children.length) ? children.length : lastCol;
                            index = (this._selectedItemIndex + 1 >= lastCol) ? index : this._selectedItemIndex + 1;
                        }
                    }
                } else if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter) {
                    // Launch application or Nautilus place or Recent document
                    let item_actor = children[this._selectedItemIndex];
                    let itemType = item_actor._delegate._type;
                    if (itemType == 0) {
                        this.menu.close();
                        item_actor._delegate._app.open_new_window(-1);
                    } else if (itemType == 1) {
                        this.menu.close();
                        item_actor._delegate._app.launch();
                    } else if (itemType == 2) {
                        this.menu.close();
                        Gio.app_info_launch_default_for_uri(item_actor._delegate._app.uri, global.create_app_launch_context(0, -1));
                    }
                    return true;
                } else {
                    return false;
                }
        }

        // Check for any change in position
        if (index == this._selectedItemIndex) {
            return true;
        }

        // Check if position reached its end
        if (index>=children.length) index = children.length-1;


        // All good .. now get item actor in container
        this._selectedItemIndex = index;
        let itemActor = children[this._selectedItemIndex];

        // Check if item actor is valid
        if (!itemActor || itemActor === this.searchEntry) {
            return false;
        }

        // Clear out container and select item actor
        this._clearApplicationSelections(itemActor);

        // Set selected app name/description
        let itemActor = children[this._selectedItemIndex];
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
        this._scrollToApplicationButton(itemActor);
        return true;
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function (se, prop) {
        if (this.searchActive) {
            if (this.searchEntry.get_text() == "") {
                this._resetDisplayApplicationsToStartup();
            } else {
                this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.CATEGORY);
                this._clearCategorySelections(this.categoriesBox);
                this._clearUserGroupButtons();
            }
        }
        this._clearApplicationSelections();
        this._selectedItemIndex = -1;
        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");


        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {

            this.searchEntry.set_secondary_icon(this._searchActiveIcon);

            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, function() {
                    this.resetSearch();
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
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;

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

        //let bookmarks = this._listBookmarks(pattern);
        //for (var i in bookmarks) placesResults.push(bookmarks[i]);

        let webBookmarks = this._listWebBookmarks(pattern);
        for (var i in webBookmarks) placesResults.push(webBookmarks[i]);


        //let devices = this._listDevices(pattern);
        //for (var i in devices) placesResults.push(devices[i]);

        let recentResults = this._listRecent(pattern);


        this._clearApplicationsBox();
        this._displayApplications(appResults, placesResults, recentResults);

        // Set active container
        let viewMode = this._applicationsViewMode;
        this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;

        // Any items in container?
        let children = this._activeContainer.get_children();
        if (children.length > 0){
            // Set selected app name/description
            this._selectedItemIndex = 0;
            let itemActor = children[this._selectedItemIndex];
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
            // Clear out container and select item actor
            this._clearApplicationSelections(itemActor);
        } else {
            this._selectedItemIndex = -1;
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }

        return false;
    },

    _display : function() {
        if (_DEBUG_) global.log("PanelMenuButton: _display");
        // popupMenuSection holds the mainbox
        let section = new PopupMenu.PopupMenuSection();

        // mainbox holds the topPane and bottomPane
        this.mainBox = new St.BoxLayout({ name: 'gnomenuMenuMainbox', style_class: 'gnomenu-main-menu-box', vertical:true });

        // Top pane holds user group, view mode, and search (packed horizonally)
        let topPane = new St.BoxLayout({ style_class: 'gnomenu-menu-top-pane' });

        // Middle pane holds shortcuts, categories/places/power, applications, workspaces (packed horizontally)
        let middlePane = new St.BoxLayout({ style_class: 'gnomenu-menu-middle-pane' });

        // Bottom pane holds power group and selected app description (packed horizontally)
        let bottomPane = new St.BoxLayout({ style_class: 'gnomenu-menu-bottom-pane' });

        // groupCategoriesWorkspacesWrapper bin wraps categories and workspaces
        this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({ style_class: 'gnomenu-categories-workspaces-wrapper', vertical: false});

        // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
        this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({ reactive: true, x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'gnomenu-categories-workspaces-scrollbox' });
        let vscroll = this.groupCategoriesWorkspacesScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));
        this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
        this.groupCategoriesWorkspacesScrollBox.connect('button-release-event', Lang.bind(this, function(actor, event) {
            if (_DEBUG_) global.log("PanelMenuButton: _display - categories-workspaces-scrollbox button release event");
            let button = event.get_button();
            if (button == 3) { //right click
                this.toggleCategoryWorkspaceMode();
            }
        }));


        // UserGroupBox
        this.userGroupBox = new St.BoxLayout({ style_class: 'gnomenu-user-group-box' });

        // Create 'recent' category button
        this.recentCategory = new GroupButton( null, null, _('Recent'), {style_class: 'gnomenu-user-group-button'});
        this.recentCategory.actor.connect('enter-event', Lang.bind(this, function() {
            this.recentCategory.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(this.recentCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.recentCategory.actor.connect('leave-event', Lang.bind(this, function() {
            this.recentCategory.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.recentCategory.actor.connect('button-press-event', Lang.bind(this, function() {
            this.recentCategory.actor.add_style_pseudo_class('pressed');
        }));
        this.recentCategory.actor.connect('button-release-event', Lang.bind(this, function() {
            this.recentCategory.actor.remove_style_pseudo_class('pressed');
            if (this.recentCategory._opened) {
                this.recentCategory._opened = false;
                this.webBookmarksCategory._opened = false;
                this.placesCategory._opened = false;
                this.recentCategory.actor.remove_style_pseudo_class('open');
                this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
                this.placesCategory.actor.remove_style_pseudo_class('open');
                this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.CATEGORY);
                this._resetDisplayApplicationsToStartup();
                //let allApplicationsCategory = this.categoriesBox.get_first_child()._delegate;
                //this._clearApplicationsBox(allApplicationsCategory);
                //this._displayApplications(this._listApplications(null));
            } else {
                this.recentCategory._opened = true;
                this.webBookmarksCategory._opened = false;
                this.placesCategory._opened = false;
                this.recentCategory.actor.add_style_pseudo_class('open');
                this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
                this.placesCategory.actor.remove_style_pseudo_class('open');
                this._selectRecent(this.recentCategory);
                this.selectedAppTitle.set_text(this.recentCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }
        }));

        // Create 'webBookmarks' category button
        this.webBookmarksCategory = new GroupButton( null, null, _('Web'), {style_class: 'gnomenu-user-group-button'});
        this.webBookmarksCategory.actor.connect('enter-event', Lang.bind(this, function() {
            this.webBookmarksCategory.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(this.webBookmarksCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.webBookmarksCategory.actor.connect('leave-event', Lang.bind(this, function() {
            this.webBookmarksCategory.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.webBookmarksCategory.actor.connect('button-press-event', Lang.bind(this, function() {
            this.webBookmarksCategory.actor.add_style_pseudo_class('pressed');
        }));
        this.webBookmarksCategory.actor.connect('button-release-event', Lang.bind(this, function() {
            this.webBookmarksCategory.actor.remove_style_pseudo_class('pressed');
            if (this.webBookmarksCategory._opened) {
                this.webBookmarksCategory._opened = false;
                this.recentCategory._opened = false;
                this.placesCategory._opened = false;
                this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
                this.recentCategory.actor.remove_style_pseudo_class('open');
                this.placesCategory.actor.remove_style_pseudo_class('open');
                this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.CATEGORY);
                this._resetDisplayApplicationsToStartup();
                //let allApplicationsCategory = this.categoriesBox.get_first_child()._delegate;
                //this._clearApplicationsBox(allApplicationsCategory);
                //this._displayApplications(this._listApplications(null));
            } else {
                this.webBookmarksCategory._opened = true;
                this.recentCategory._opened = false;
                this.placesCategory._opened = false;
                this.webBookmarksCategory.actor.add_style_pseudo_class('open');
                this.recentCategory.actor.remove_style_pseudo_class('open');
                this.placesCategory.actor.remove_style_pseudo_class('open');
                this._selectWebBookmarks(this.webBookmarksCategory);
                this.selectedAppTitle.set_text(this.webBookmarksCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }
        }));

        // Create 'places-favorites' category button
        if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
            this.placesCategory = new GroupButton( null, null, _('Favorites'), {style_class: 'gnomenu-user-group-button'});
        } else {
            this.placesCategory = new GroupButton( null, null, _('Places'), {style_class: 'gnomenu-user-group-button'});
        }
        this.placesCategory.actor.connect('enter-event', Lang.bind(this, function() {
            this.placesCategory.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(this.placesCategory.label.get_text());
            this.selectedAppDescription.set_text('');
        }));
        this.placesCategory.actor.connect('leave-event', Lang.bind(this, function() {
            this.placesCategory.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        this.placesCategory.actor.connect('button-press-event', Lang.bind(this, function() {
            this.placesCategory.actor.add_style_pseudo_class('pressed');
        }));
        this.placesCategory.actor.connect('button-release-event', Lang.bind(this, function() {
            this.placesCategory.actor.remove_style_pseudo_class('pressed');
            if (this.placesCategory._opened) {
                this.placesCategory._opened = false;
                this.webBookmarksCategory._opened = false;
                this.recentCategory._opened = false;
                this.placesCategory.actor.remove_style_pseudo_class('open');
                this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
                this.recentCategory.actor.remove_style_pseudo_class('open');
                this.toggleCategoryWorkspaceMode(CategoryWorkspaceMode.CATEGORY);
                this._resetDisplayApplicationsToStartup();
                //let allApplicationsCategory = this.categoriesBox.get_first_child()._delegate;
                //this._clearApplicationsBox(allApplicationsCategory);
                //this._displayApplications(this._listApplications(null));
            } else {
                this.placesCategory._opened = true;
                this.webBookmarksCategory._opened = false;
                this.recentCategory._opened = false;
                this.placesCategory.actor.add_style_pseudo_class('open');
                this.webBookmarksCategory.actor.remove_style_pseudo_class('open');
                this.recentCategory.actor.remove_style_pseudo_class('open');
                if (settings.get_enum('shortcuts-display') == ShortcutsDisplay.PLACES) {
                    this._selectFavorites(this.placesCategory);
                } else {
                    this._selectAllPlaces(this.placesCategory);
                }
                this.selectedAppTitle.set_text(this.placesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }
        }));



        let userGroupBoxSpacer1 = new St.Label({text: ''});
        let userGroupBoxSpacer2 = new St.Label({text: ''});
        this.userGroupBox.add(this.recentCategory.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(userGroupBoxSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(this.webBookmarksCategory.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(userGroupBoxSpacer2, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(this.placesCategory.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});


        // ViewModeBox
        let viewModButtonIconSize = 20;
        if (settings.get_enum('menu-layout') == MenuLayout.MEDIUM) {
            viewModButtonIconSize = 18;
        } else if (settings.get_enum('menu-layout') == MenuLayout.SMALL) {
            viewModButtonIconSize = 16;
        }

        this.viewModeBoxWrapper = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box-wrapper' });
        this.viewModeBox = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box' });
        let listView = new GroupButton('view-list-symbolic', viewModButtonIconSize, null, {style_class: 'gnomenu-view-mode-button'});
        listView.actor.connect('enter-event', Lang.bind(this, function() {
            listView.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('List View'));
            this.selectedAppDescription.set_text('');
        }));
        listView.actor.connect('leave-event', Lang.bind(this, function() {
            listView.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        listView.actor.connect('button-press-event', Lang.bind(this, function() {
            listView.actor.add_style_pseudo_class('pressed');
        }));
        listView.actor.connect('button-release-event', Lang.bind(this, function() {
            listView.actor.remove_style_pseudo_class('pressed');
            listView.actor.add_style_pseudo_class('open');
            gridView.actor.remove_style_pseudo_class('open');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this._switchApplicationsView(ApplicationsViewMode.LIST);
        }));
        let gridView = new GroupButton( 'view-grid-symbolic', viewModButtonIconSize, null, {style_class: 'gnomenu-view-mode-button'});
        gridView.actor.connect('enter-event', Lang.bind(this, function() {
            gridView.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Grid View'));
            this.selectedAppDescription.set_text('');
        }));
        gridView.actor.connect('leave-event', Lang.bind(this, function() {
            gridView.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        gridView.actor.connect('button-press-event', Lang.bind(this, function() {
            gridView.actor.add_style_pseudo_class('pressed');
        }));
        gridView.actor.connect('button-release-event', Lang.bind(this, function() {
            gridView.actor.remove_style_pseudo_class('pressed');
            gridView.actor.add_style_pseudo_class('open');
            listView.actor.remove_style_pseudo_class('open');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this._switchApplicationsView(ApplicationsViewMode.GRID);
        }));
        this.viewModeBox.add(gridView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBox.add(listView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBoxWrapper.add_actor(this.viewModeBox);
        let viewMode = this._applicationsViewMode;
        if (viewMode == ApplicationsViewMode.LIST) {
            listView.actor.add_style_pseudo_class('open');
        } else {
            gridView.actor.add_style_pseudo_class('open');
        }

        // SearchBox
        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find-symbolic' });
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear-symbolic' });
        this.searchBox = new St.BoxLayout({ style_class: 'gnomenu-search-box' });
        this.searchEntry = new St.Entry({ name: 'searchEntry',
                                     style_class: 'search-entry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });

        this.searchEntry.set_primary_icon(this._searchInactiveIcon);
        this.searchBox.add(this.searchEntry, {expand: true, x_align:St.Align.START, y_align:St.Align.START});
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";


        // ShortcutsBox
        this.shortcutsBox = new St.BoxLayout({ style_class: 'gnomenu-shortcuts-box', vertical: true });
        this.shortcutsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'gnomenu-shortcuts-scrollbox' });
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.shortcutsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.shortcutsScrollBox.set_mouse_scrolling(true);

        if (settings.get_boolean('hide-shortcuts')) {
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
                shortcutButton.actor.add_style_pseudo_class('active');
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
                shortcutButton.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
            }));
            shortcutButton.actor.connect('button-press-event', Lang.bind(this, function() {
                shortcutButton.actor.add_style_pseudo_class('pressed');
            }));
            shortcutButton.actor.connect('button-release-event', Lang.bind(this, function() {
                shortcutButton.actor.remove_style_pseudo_class('pressed');
                shortcutButton.actor.remove_style_pseudo_class('active');
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

        // Workspaces thumbnails Box
        this.thumbnailsBoxFiller = new St.BoxLayout({ style_class: 'gnomenu-workspaces-filler', vertical: true });
        this.thumbnailsBox = new WorkspaceThumbnail.myThumbnailsBox(gsVersion, settings, this.thumbnailsBoxFiller);

        // CategoriesBox
        this.categoriesBox = new St.BoxLayout({ style_class: 'gnomenu-categories-box', vertical: true });

        // Initialize application categories
        this.applicationsByCategory = {};

        // Load 'frequent applications' category
        let freqAppCategory = new CategoryListButton('frequent', _('Frequent Apps'));
        if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
            freqAppCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectCategory(freqAppCategory);
                this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            freqAppCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            freqAppCategory.actor.connect('enter-event', Lang.bind(this, function() {
                freqAppCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            freqAppCategory.actor.connect('leave-event', Lang.bind(this, function() {
                freqAppCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            freqAppCategory.actor.connect('button-press-event', Lang.bind(this, function() {
                freqAppCategory.actor.add_style_pseudo_class('pressed');
            }));
            freqAppCategory.actor.connect('button-release-event', Lang.bind(this, function() {
                freqAppCategory.actor.remove_style_pseudo_class('pressed');
                freqAppCategory.actor.remove_style_pseudo_class('active');
                this._selectCategory(freqAppCategory);
                this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.categoriesBox.add_actor(freqAppCategory.actor);

        // Load 'all applications' category
        let allAppCategory = new CategoryListButton('all', _('All Applications'));
        if (settings.get_enum('category-selection-method') == SelectMethod.HOVER ) {
            allAppCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectCategory(allAppCategory);
                this.selectedAppTitle.set_text(allAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            allAppCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            allAppCategory.actor.connect('enter-event', Lang.bind(this, function() {
                allAppCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(allAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            allAppCategory.actor.connect('leave-event', Lang.bind(this, function() {
                allAppCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            allAppCategory.actor.connect('button-press-event', Lang.bind(this, function() {
                allAppCategory.actor.add_style_pseudo_class('pressed');
            }));
            allAppCategory.actor.connect('button-release-event', Lang.bind(this, function() {
                allAppCategory.actor.remove_style_pseudo_class('pressed');
                allAppCategory.actor.remove_style_pseudo_class('active');
                this._selectCategory(allAppCategory);
                this.selectedAppTitle.set_text(allAppCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.categoriesBox.add_actor(allAppCategory.actor);

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
                    let appCategory = new CategoryListButton(dir);
                    if (settings.get_enum('category-selection-method') == SelectMethod.HOVER) {
                        appCategory.actor.connect('enter-event', Lang.bind(this, function() {
                            this._selectCategory(appCategory);
                            this.selectedAppTitle.set_text(appCategory.label.get_text());
                            this.selectedAppDescription.set_text('');
                        }));
                        appCategory.actor.connect('leave-event', Lang.bind(this, function() {
                            this.selectedAppTitle.set_text('');
                            this.selectedAppDescription.set_text('');
                        }));
                    } else {
                        appCategory.actor.connect('enter-event', Lang.bind(this, function() {
                            appCategory.actor.add_style_pseudo_class('active');
                            this.selectedAppTitle.set_text(appCategory.label.get_text());
                            this.selectedAppDescription.set_text('');
                        }));
                        appCategory.actor.connect('leave-event', Lang.bind(this, function() {
                            appCategory.actor.remove_style_pseudo_class('active');
                            this.selectedAppTitle.set_text('');
                            this.selectedAppDescription.set_text('');
                        }));
                        appCategory.actor.connect('button-press-event', Lang.bind(this, function() {
                            appCategory.actor.add_style_pseudo_class('pressed');
                        }));
                        appCategory.actor.connect('button-release-event', Lang.bind(this, function() {
                            appCategory.actor.remove_style_pseudo_class('pressed');
                            appCategory.actor.remove_style_pseudo_class('active');
                            this._selectCategory(appCategory);
                            this.selectedAppTitle.set_text(appCategory.label.get_text());
                            this.selectedAppDescription.set_text('');
                        }));
                    }
                    this.categoriesBox.add_actor(appCategory.actor);
                }
            }
        }
        if (_DEBUG_) global.log("PanelMenuButton: _display - end loading categories");

        // PowerGroupBox
        this.powerGroupBox = new St.BoxLayout({ style_class: 'gnomenu-power-group-box'});
        let powerGroupButtonIconSize = 20;
        if (settings.get_enum('menu-layout') == MenuLayout.MEDIUM) {
            powerGroupButtonIconSize = 18;
        } else if (settings.get_enum('menu-layout') == MenuLayout.SMALL) {
            powerGroupButtonIconSize = 16;
        }
        let systemRestart = new GroupButton('refresh-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        systemRestart.actor.connect('enter-event', Lang.bind(this, function() {
            systemRestart.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Restart Shell'));
            this.selectedAppDescription.set_text('');
        }));
        systemRestart.actor.connect('leave-event', Lang.bind(this, function() {
            systemRestart.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        systemRestart.actor.connect('button-press-event', Lang.bind(this, function() {
            systemRestart.actor.add_style_pseudo_class('pressed');
        }));
        systemRestart.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to refresh shell
            systemRestart.actor.remove_style_pseudo_class('pressed');
            systemRestart.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            global.reexec_self();
        }));
        let systemSuspend = new GroupButton('suspend-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        systemSuspend.actor.connect('enter-event', Lang.bind(this, function() {
            systemSuspend.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Suspend'));
            this.selectedAppDescription.set_text('');
        }));
        systemSuspend.actor.connect('leave-event', Lang.bind(this, function() {
            systemSuspend.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        systemSuspend.actor.connect('button-press-event', Lang.bind(this, function() {
            systemSuspend.actor.add_style_pseudo_class('pressed');
        }));
        systemSuspend.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to suspend
            systemSuspend.actor.remove_style_pseudo_class('pressed');
            systemSuspend.actor.remove_style_pseudo_class('active');
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
        let systemShutdown = new GroupButton('shutdown-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        systemShutdown.actor.connect('enter-event', Lang.bind(this, function() {
            systemShutdown.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Shutdown'));
            this.selectedAppDescription.set_text('');
        }));
        systemShutdown.actor.connect('leave-event', Lang.bind(this, function() {
            systemShutdown.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        systemShutdown.actor.connect('button-press-event', Lang.bind(this, function() {
            systemShutdown.actor.add_style_pseudo_class('pressed');
        }));
        systemShutdown.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to shutdown (power off)
            // ToDo: GS38 itterates through SystemLoginSession to check for open sessions
            // and displays an openSessionWarnDialog
            systemShutdown.actor.remove_style_pseudo_class('pressed');
            systemShutdown.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.ShutdownRemote();
        }));
        let logoutUser = new GroupButton('user-logout-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        logoutUser.actor.connect('enter-event', Lang.bind(this, function() {
            logoutUser.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Logout User'));
            this.selectedAppDescription.set_text('');
        }));
        logoutUser.actor.connect('leave-event', Lang.bind(this, function() {
            logoutUser.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        logoutUser.actor.connect('button-press-event', Lang.bind(this, function() {
            logoutUser.actor.add_style_pseudo_class('pressed');
        }));
        logoutUser.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to logout user
            logoutUser.actor.remove_style_pseudo_class('pressed');
            logoutUser.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.LogoutRemote(0);
        }));
        let lockScreen = new GroupButton('user-lock-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        lockScreen.actor.connect('enter-event', Lang.bind(this, function() {
            lockScreen.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Lock Screen'));
            this.selectedAppDescription.set_text('');
        }));
        lockScreen.actor.connect('leave-event', Lang.bind(this, function() {
            lockScreen.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        lockScreen.actor.connect('button-press-event', Lang.bind(this, function() {
            lockScreen.actor.add_style_pseudo_class('pressed');
        }));
        lockScreen.actor.connect('button-release-event', Lang.bind(this, function() {
            // code for lock options
            lockScreen.actor.remove_style_pseudo_class('pressed');
            lockScreen.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            Main.overview.hide();
            Main.screenShield.lock(true);
        }));

        let powerGroupBoxSpacer1 = new St.Label({text: ''});
        let powerGroupBoxSpacer2 = new St.Label({text: ''});
        let powerGroupBoxSpacer3 = new St.Label({text: ''});
        let powerGroupBoxSpacer4 = new St.Label({text: ''});
        this.powerGroupBox.add(systemRestart.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(systemSuspend.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer2, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(systemShutdown.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer3, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(logoutUser.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer4, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(lockScreen.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});

        // ApplicationsBox (ListView / GridView)
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade gnomenu-applications-scrollbox' });
        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));

        this.applicationsListBox = new St.BoxLayout({ style_class: 'gnomenu-applications-list-box', vertical:true });
        this.applicationsGridBox = new St.Table({ homogeneous:false, reactive:true, style_class: 'gnomenu-applications-grid-box'});
        this.applicationsBoxWrapper = new St.BoxLayout({ style_class: 'gnomenu-applications-box-wrapper' });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.applicationsBoxWrapper.add(this.applicationsListBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_mouse_scrolling(true);


        // selectedAppBox
        this.selectedAppBox = new St.BoxLayout({ style_class: 'gnomenu-selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'gnomenu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'gnomenu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);

        // Extension Preferences
        let extensionPreferences = new GroupButton('control-center-alt-symbolic', powerGroupButtonIconSize, null, {style_class: 'gnomenu-power-group-button'});
        extensionPreferences.actor.connect('enter-event', Lang.bind(this, function() {
            extensionPreferences.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Preferences'));
            this.selectedAppDescription.set_text('');
        }));
        extensionPreferences.actor.connect('leave-event', Lang.bind(this, function() {
            extensionPreferences.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        extensionPreferences.actor.connect('button-press-event', Lang.bind(this, function() {
            extensionPreferences.actor.add_style_pseudo_class('pressed');
        }));
        extensionPreferences.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to show extension preferences
            extensionPreferences.actor.remove_style_pseudo_class('pressed');
            extensionPreferences.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            Main.Util.trySpawnCommandLine(PREFS_DIALOG);
            this.menu.close();
        }));



        // Place boxes in proper containers. The order added determines position
        // ----------------------------------------------------------------------

        // topPane packs horizontally
        let topPaneSpacer1 = new St.Label({text: ''});
        let topPaneSpacer2 = new St.Label({text: ''});
        topPane.add(this.userGroupBox);
        topPane.add(topPaneSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        topPane.add(this.viewModeBoxWrapper);
        topPane.add(topPaneSpacer2, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        topPane.add(this.searchBox, {expand: true, x_align:St.Align.END, y_align:St.Align.MIDDLE});

        this.groupCategoriesWorkspacesWrapper.add(this.thumbnailsBoxFiller, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.groupCategoriesWorkspacesWrapper.add(this.thumbnailsBox.actor, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);

        // middlePane packs horizontally
        middlePane.add(this.shortcutsScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        middlePane.add(this.groupCategoriesWorkspacesScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        middlePane.add(this.applicationsScrollBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});

        // bottomPane packs horizontally
        let bottomPaneSpacer1 = new St.Label({text: ''});
        bottomPane.add(this.powerGroupBox, {x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        bottomPane.add(bottomPaneSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        bottomPane.add(this.selectedAppBox, {expand: true, x_align:St.Align.END, y_align:St.Align.MIDDLE});
        bottomPane.add(extensionPreferences.actor, {x_fill:false, y_fill: false, x_align:St.Align.END, y_align:St.Align.MIDDLE});


        // mainbox packs vertically
        this.mainBox.add_actor(topPane);
        this.mainBox.add_actor(middlePane);
        this.mainBox.add_actor(bottomPane);

        // add all to section
        section.actor.add_actor(this.mainBox);

        // add section as menu item
        this.menu.addMenuItem(section);


        // Set height constraints on scrollboxes (we also set height when menu toggle)
        this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({name: 'constraint', source: this.groupCategoriesWorkspacesScrollBox, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));
        this.shortcutsScrollBox.add_constraint(new Clutter.BindConstraint({name: 'constraint', source: this.groupCategoriesWorkspacesScrollBox, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));

        //this._widthCategoriesBox = this.categoriesBox.width;
        this.thumbnailsBox.actor.width = this.categoriesBox.width;
        this.thumbnailsBox._actualThumbnailWidth = this.categoriesBox.width;
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

        // Bind Preference Settings
        this._bindSettingsChanges();

        // Initialize GnoMenuButton actor
        this.actor = new St.BoxLayout({ name: 'gnomenuPanelBox', style_class: 'gnomenu-panel-box' });

        this._setHotSpotTimeoutId = 0;
        this._display();
    },

    refresh: function() {
        if (_DEBUG_) global.log("GnoMenuButton: refresh");
        this._clearAll();
        this._display();
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
                Main.wm.addKeybinding('panel-menu-keyboard-accelerator', settings, Meta.KeyBindingFlags.NONE, Shell.KeyBindingMode.NORMAL,
                    Lang.bind(this, function() {
                        if (this.appsMenuButton) {
                            if (!this.appsMenuButton.menu.isOpen)
                                this.appsMenuButton.menu.toggle();
                        }
                    })
                );
            }
        }

        // Add buttons to GnoMenuButton actor
        if (this.viewButton) this.actor.add(this.viewButton.container);
        if (this.appsButton) this.actor.add(this.appsButton.container);
        if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);
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
            } else {
                Main.overview.viewSelector._showAppsButton.checked = false;
            }
        } else {
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
            } else {
                Main.overview.viewSelector._showAppsButton.checked = true;
            }
        } else {
            Main.overview.show();
            Main.overview.viewSelector._showAppsButton.checked = true;
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
        let ml = "";
        if (settings.get_enum('menu-layout') == MenuLayout.SMALL) {
            ml = "-s";
        } else if (settings.get_enum('menu-layout') == MenuLayout.MEDIUM) {
            ml = "-m";
        }

        // Get css filename
        let filename = "gnomenu" + ml + ".css";

        // Get new theme stylesheet
        let themeStylesheet = Main._defaultCssStylesheet;
        if (Main._cssStylesheet != null)
            themeStylesheet = Main._cssStylesheet;

        // Get theme directory
        let themeDirectory = GLib.path_get_dirname(themeStylesheet);
        if (_DEBUG_) global.log("GnoMenuButton: _changedStylesheet new theme = "+themeStylesheet);

        // Test for gnomenu stylesheet
        let newStylesheet = themeDirectory + '/extensions/gno-menu/' + filename;
        if (!GLib.file_test(newStylesheet, GLib.FileTest.EXISTS)) {
            if (_DEBUG_) global.log("GnoMenuButton: _chengeStylesheet Theme doesn't support gnomenu .. use default stylesheet");
            let defaultStylesheet = Gio.File.new_for_path(Me.path + "/themes/default/" + filename);
            if (defaultStylesheet.query_exists(null)) {
                newStylesheet = defaultStylesheet.get_path();
            } else {
                throw new Error(_("No GnoMenu stylesheet found") + " (extension.js).");
            }
        }

        if (GnoMenuStylesheet && GnoMenuStylesheet == newStylesheet) {
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
            if (customStylesheets[i] != previousStylesheet) {
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
        settings.connect('changed::panel-menu-icon-name', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-menu-hotspot', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
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
        settings.connect('changed::hide-shortcuts', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
    },

    // function to destroy GnoMenuButton
    destroy: function() {
        // Disconnect global signals
        Shell.AppSystem.get_default().disconnect(this._installedChangedId);
        AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);
        IconTheme.get_default().disconnect(this._iconsChangedId);
        St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);

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
    let ml = "";
    if (settings.get_enum('menu-layout') == MenuLayout.SMALL) {
        ml = "-s";
    } else if (settings.get_enum('menu-layout') == MenuLayout.MEDIUM) {
        ml = "-m";
    }

    // Get css filename
    let filename = "gnomenu" + ml + ".css";

    // Get current theme stylesheet
    let themeStylesheet = Main._defaultCssStylesheet;
    if (Main._cssStylesheet != null)
        themeStylesheet = Main._cssStylesheet;

    // Get theme directory
    let themeDirectory = GLib.path_get_dirname(themeStylesheet);

    // Test for gnomenu stylesheet
    GnoMenuStylesheet = themeDirectory + '/extensions/gno-menu/' + filename;
    if (!GLib.file_test(GnoMenuStylesheet, GLib.FileTest.EXISTS)) {
        if (_DEBUG_) global.log("GnoMenu Extension: Theme doesn't support gnomenu .. use default stylesheet");
        let defaultStylesheet = Gio.File.new_for_path(Me.path + "/themes/default/" + filename);
        if (defaultStylesheet.query_exists(null)) {
            GnoMenuStylesheet = defaultStylesheet.get_path();
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
    Main.panel._leftBox.insert_child_at_index(GnoMenu.actor, 0);
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
