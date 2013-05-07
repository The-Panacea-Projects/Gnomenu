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
 * ========================================================================================================
 */

const _DEBUG_ = true;

const IconTheme = imports.gi.Gtk.IconTheme;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GMenu = imports.gi.GMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Pango = imports.gi.Pango;
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
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const AppDisplay = imports.ui.appDisplay;


const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
let settings = Convenience.getSettings('org.gnome.shell.extensions.gnomenu');

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const gsVersion = Config.PACKAGE_VERSION.split('.');
let PlaceDisplay;
let UnlockDialog;
if (gsVersion[1] > 4) {
    PlaceDisplay = Me.imports.placeDisplay;
    UnlockDialog = imports.ui.unlockDialog;
} else {
    PlaceDisplay = imports.ui.placeDisplay;
}

const appsDisplay = {
    ALL: 0,
    FAVORITES: 1,
    PLACES: 2,
    RECENT: 3
};

const selectMethod = {
    HOVER: 0,
    CLICK: 1
};

/* =========================================================================
/* name:    CategoryListButton
 * @desc    A button with an icon that holds category info
 * ========================================================================= */

const CategoryListButton = new Lang.Class({
    Name: 'GnoMenu.CategoryListButton',

    _init: function (app, altNameText, altIconName) {
        let style = (gsVersion[1] > 4) ? 'popup-menu-item gnomenu-category-button' : 'gnomenu-category-button';
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.START, y_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        let iconSize = 28;

        this._app = null;
        let categoryNameText = "";
        let categoryIconName = null;

        if (!app) {
            categoryNameText = altNameText;
            categoryIconName = altIconName;
        } else {
            this._app = app;
            categoryNameText = app.get_name();
            categoryIconName =  app.get_icon().get_names().toString();
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
/* name:    FavoriteButton
 * @desc    A button with an icon that holds app info
 * ========================================================================= */

const FavoriteButton = new Lang.Class({
    Name: 'GnoMenu.FavoriteButton',

    _init: function (app) {
        this._app = app;
        let style = (gsVersion[1] > 4) ? 'popup-menu-item gnomenu-favorite-button' : 'gnomenu-favorite-button';
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.START });
        this.actor._delegate = this;
        let iconSize = (settings.get_int('favorites-icon-size') > 0) ? settings.get_int('favorites-icon-size') : 32;

        this.icon = this._app.create_icon_texture(iconSize);
        //this.label = new St.Label({ text: app.get_name(), style_class: 'favorite-button-label' });

        this.buttonbox = new St.BoxLayout();
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        //this.buttonbox.add(this.label, {x_fill: false, y_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);
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
        let style = (gsVersion[1] > 4) ? 'popup-menu-item gnomenu-application-button' : 'gnomenu-application-button';
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.actor._delegate = this;
        let iconSize = (settings.get_int('apps-list-icon-size') > 0) ? settings.get_int('apps-list-icon-size') : 28;

        // appType should probably be enumerated
        // appType 0 = application, appType 1 = place
        if (appType == 0) {
            this.icon = app.create_icon_texture(iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-application-button-label' });
        } else if (appType == 1) {
            if (gsVersion[1] > 4) {
                this.icon = new St.Icon({gicon: app.icon, icon_size: iconSize});
                if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR, style_class: 'overview-icon'});
            } else {
                this.icon = app.iconFactory(iconSize);
                if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR, style_class: 'overview-icon'});
            }
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-button-label' });
        } else if (appType == 2) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-button-label' });
        }

        this.buttonbox = new St.BoxLayout();
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.buttonbox.add(this.label, {x_fill: false, y_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE});

        this.actor.set_child(this.buttonbox);

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
        let style = (gsVersion[1] > 4) ? 'popup-menu-item gnomenu-application-grid-button' : 'gnomenu-application-grid-button';
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        this.actor._delegate = this;
        let iconSize = (settings.get_int('apps-grid-icon-size') > 0) ? settings.get_int('apps-grid-icon-size') : 64;

        // appType should probably be enumerated
        // appType 0 = application, appType 1 = place, appType 2 = recent
        if (appType == 0) {
            this.icon = app.create_icon_texture(iconSize);
            this.label = new St.Label({ text: app.get_name(), style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == 1) {
            if (gsVersion[1] > 4) {
                this.icon = new St.Icon({gicon: app.icon, icon_size: iconSize});
                if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
            } else {
                this.icon = app.iconFactory(iconSize);
                if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
            }
            this.label = new St.Label({ text: app.name, style_class: 'gnomenu-application-grid-button-label' });
        } else if (appType == 2) {
            let gicon = Gio.content_type_get_icon(app.mime);
            this.icon = new St.Icon({gicon: gicon, icon_size: iconSize});
            if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
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

        let style = (gsVersion[1] > 4) ? 'popup-menu-item' : '';
        this.actor = new St.Button({ reactive: true, style_class: style, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor.add_style_class_name(params.style_class);

        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout({vertical: true});

        //this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize, icon_type: St.IconType.SYMBOLIC});
        this.icon = new St.Icon({icon_name: iconName, icon_size: iconSize});
        this.buttonbox.add(this.icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
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

    _init: function(nameText) {

        this.parent(0.0, '', true);

        this._box = new St.BoxLayout({ style_class: 'gnomenu-panel-button' });
        this.actor.add_actor(this._box);

        //// Add icon to button
        //let icon = new St.Icon({ gicon: null, style_class: 'system-status-icon' });
        //this._box.add_actor(icon);
        //icon.icon_name='start-here';

        // Add label to button
        let label = new St.Label({ text: nameText});
        this._box.add_actor(label);
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
        this._box = new St.BoxLayout({ style_class: 'gnomenu-panel-menu-button' });
        this.actor.add_actor(this._box);

        // Add icon to button
        let icon = new St.Icon({ gicon: null, style_class: 'system-status-icon' });
        this._box.add_actor(icon);
        icon.icon_name='start-here';

        // Add label to button
        let label = new St.Label({ text: ' '+_('Menu')});
        this._box.add_actor(label);

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));

        this.applicationsByCategory = {};
        this.favorites = [];
        this._applications = new Array();
        this._places = new Array();
        this._recent = new Array();

        this._applicationsViewMode = settings.get_enum('startup-view-mode');
        this._appGridColumns = 5;
        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;

        this._session = new GnomeSession.SessionManager();
        this.recentManager = Gtk.RecentManager.get_default();
        if (PlaceDisplay) {
            this.placesManager = new PlaceDisplay.PlacesManager();
        } else {
            this.placesManager = null;
        }

        this._display();
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
            //global.log("_onOpenStateToggled x="+x+"  w="+w);
            // -----------------------------------------------

            // Set focus to search entry
            global.stage.set_key_focus(this.searchEntry);

            // Fixes issue in GS 3.8 where search entry is not focused
            // for some reason, GS 3.8 steals the focus back
            if (gsVersion[1] > 6) {
                if (this._menuToggleTimeoutId > 0)
                    Mainloop.source_remove(this._menuToggleTimeoutId);

                this._menuToggleTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, this.resetSearch));
            }

            // Load All Applications category
            this._selectedItemIndex = null;
            this._activeContainer = null;

            this._applicationsViewMode = settings.get_enum('startup-view-mode');
            if (settings.get_enum('startup-apps-display') == appsDisplay.FAVORITES) {
                this._clearApplicationsBox();
                this._displayApplications(this._listApplications('favorites'));
            } else {
                let allApplicationsCategory = this.categoriesBox.get_first_child()._delegate;
                this._clearApplicationsBox(allApplicationsCategory);
                this._displayApplications(this._listApplications(null));
            }

            // Set height (we also set constraints on scrollboxes
            // Why does height need to be set when already set constraints? because of issue noted below
            // ISSUE: If height isn't set, then popup menu height will expand when application buttons are added
            let height = this.groupCategoryPlacesPower.height;
            this.applicationsScrollBox.height = height;
            this.favoritesScrollBox.height = height;
            this.userGroupBox.width = this.favoritesScrollBox.width + this.groupCategoryPlacesPower.width;
        } else {
            this.resetSearch();
            this._clearCategorySelections(this.categoriesBox);
            this._clearCategorySelections(this.placesBox);
            this._clearApplicationSelections();
            this._clearApplicationsBox();
            global.stage.set_key_focus(null);
            if (gsVersion[1] > 6) {
                if (this._menuToggleTimeoutId > 0)
                    Mainloop.source_remove(this._menuToggleTimeoutId);
            }
        }
    },

    refresh: function() {
        this._clearAll();
        this._display();
    },

    _clearAll: function() {
        this.menu.removeAll();
    },

    _loadCategories: function(dir, root) {
        var rootDir = root;
        //if (_DEBUG_) global.log("_loadCategories: dir="+dir.get_menu_id()+" root="+rootDir);
        var iter = dir.iter();
        var nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                //if (_DEBUG_) global.log("_loadCategories: TreeItemType.ENTRY");
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    //if (_DEBUG_) global.log("_loadCategories: entry valid");
                    var app = Shell.AppSystem.get_default().lookup_app_by_tree_entry(entry);
                    if (rootDir) {
                        //if (_DEBUG_) global.log("_loadCategories: push root.get_menu_id = "+rootDir.get_menu_id());
                        if (rootDir.get_menu_id())
                            this.applicationsByCategory[rootDir.get_menu_id()].push(app);
                    } else {
                        //if (_DEBUG_) global.log("_loadCategories: push dir.get_menu_id = "+dir.get_menu_id());
                        if (dir.get_menu_id())
                            this.applicationsByCategory[dir.get_menu_id()].push(app);
                    }
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                //if (_DEBUG_) global.log("_loadCategories: TreeItemType.DIRECTORY");
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
        this._clearApplicationsBox(button);
        let category = button._app;
        if (category)
            this._displayApplications(this._listApplications(category.get_menu_id()));
        else
            this._displayApplications(this._listApplications(null));
    },

    _selectAllPlaces : function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button);

        let places = this._listPlaces();
        let bookmarks = this._listBookmarks();
        let devices = this._listDevices();

        let allPlaces = places.concat(bookmarks.concat(devices));
        this._displayApplications(null, allPlaces);
    },

    //_selectComputer : function(button) {
        //this.resetSearch();
        //this._clearApplicationsBox(button);

        //let places = this._listPlaces();
        //this._displayApplications(null, places);
    //},

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
                    actor.add_style_pseudo_class('selected');
                    actor.add_style_pseudo_class('active');
                    actor.add_style_class_name("gnomenu-category-button-selected");
                } else {
                    actor.remove_style_pseudo_class('selected');
                    actor.remove_style_pseudo_class('active');
                    actor.remove_style_class_name("gnomenu-category-button-selected");
                }
            }
        }
    },

    _clearApplicationSelections: function(selectedApplication) {
        let viewMode = this._applicationsViewMode;
        this.applicationsListBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_pseudo_class('selected');
                actor.add_style_pseudo_class('active');
                actor.add_style_class_name("gnomenu-application-button-selected");
            } else {
                actor.remove_style_pseudo_class('selected');
                actor.remove_style_pseudo_class('active');
                actor.remove_style_class_name("gnomenu-application-button-selected");
            }
        });

        this.applicationsGridBox.get_children().forEach(function(actor) {
            if (selectedApplication && (actor == selectedApplication)) {
                actor.add_style_pseudo_class('selected');
                actor.add_style_pseudo_class('active');
                actor.add_style_class_name("gnomenu-application-grid-button-selected");
            } else {
                actor.remove_style_pseudo_class('selected');
                actor.remove_style_pseudo_class('active');
                actor.remove_style_class_name("gnomenu-application-grid-button-selected");
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
                    actor.add_style_pseudo_class('active');
                    actor.add_style_class_name("gnomenu-category-button-selected");
                } else {
                    actor.remove_style_pseudo_class('active');
                    actor.remove_style_class_name("gnomenu-category-button-selected");
                }
            }
        }

        let placesActors = this.placesBox.get_children();
        if (placesActors) {
            for (let i = 0; i < placesActors.length; i++) {
                let actor = placesActors[i];
                if (selectedCategory && (actor == selectedCategory.actor)) {
                    actor.add_style_pseudo_class('active');
                    actor.add_style_class_name("gnomenu-category-button-selected");
                } else {
                    actor.remove_style_pseudo_class('active');
                    actor.remove_style_class_name("gnomenu-category-button-selected");
                }
            }
        }


    },

    _listPlaces: function(pattern) {
        if (!this.placesManager)
            return null;
        let places = this.placesManager.getDefaultPlaces();
        let res = new Array();
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
        let res = new Array();
        for (let id = 0; id < bookmarks.length; id++) {
            if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1)
                res.push(bookmarks[id]);
        }
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

        if (category_menu_id == 'favorites') {
            applist = this.favorites;
        } else {
            if (category_menu_id) {
                applist = this.applicationsByCategory[category_menu_id];
            } else {
                applist = new Array();
                for (let directory in this.applicationsByCategory)
                    applist = applist.concat(this.applicationsByCategory[directory]);
            }
        }

        let res;
        if (pattern) {
            res = new Array();
            for (let i in applist) {
                let app = applist[i];
                if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1))
                    res.push(app);
            }
        } else {
            res = applist;
        }

        // Ignore favorites when sorting
        if (!category_menu_id == 'favorites') {
            res.sort(function(a,b) {
                return a.get_name().toLowerCase() > b.get_name().toLowerCase();
            });
        }

        return res;
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
            appType = 0;
            for (let i in apps) {
                let app = apps[i];
                // only add if not already in this._applications or refreshing
                if (refresh || !this._applications[app]) {
                    if (viewMode == 0) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.get_name());
                           if (appListButton._app.get_description()) this.selectedAppDescription.set_text(appListButton._app.get_description());
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           if (!appListButton.actor.has_style_pseudo_class('selected')) appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
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
                           if (!appGridButton.actor.has_style_pseudo_class('selected')) appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
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
            appType = 1;
            for (let i in places) {
                let app = places[i];
                // only add if not already in this._places or refreshing
                if (refresh || !this._places[app.name]) {
                    if (viewMode == 0) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           if (!appListButton.actor.has_style_pseudo_class('selected')) appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appListButton._app.launch();
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
                           if (!appGridButton.actor.has_style_pseudo_class('selected')) appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           appGridButton._app.launch();
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
            appType = 2;
            for (let i in recent) {
                let app = recent[i];
                // only add if not already in this._recent or refreshing
                if (refresh || !this._recent[app.name]) {
                    if (viewMode == 0) { // ListView
                        let appListButton = new AppListButton(app, appType);
                        appListButton.actor.connect('enter-event', Lang.bind(this, function() {
                           appListButton.actor.add_style_pseudo_class('active');
                           this.selectedAppTitle.set_text(appListButton._app.name);
                           if (appListButton._app.description) this.selectedAppDescription.set_text(appListButton._app.description);
                           else this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('leave-event', Lang.bind(this, function() {
                           if (!appListButton.actor.has_style_pseudo_class('selected')) appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appListButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context());
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
                           if (!appGridButton.actor.has_style_pseudo_class('selected')) appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                        }));
                        appGridButton.actor.connect('button-release-event', Lang.bind(this, function() {
                           appGridButton.actor.remove_style_pseudo_class('active');
                           this.selectedAppTitle.set_text("");
                           this.selectedAppDescription.set_text("");
                           Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context());
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
            this._activeContainer = (viewMode == 0) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = (viewMode == 0) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Left) {
            this._activeContainer = this.categoriesBox;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Right) {
            this._activeContainer = (viewMode == 0) ? this.applicationsListBox : this.applicationsGridBox;
        } else if (this._activeContainer === null) {
            this._activeContainer = (viewMode == 0) ? this.applicationsListBox : this.applicationsGridBox;
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
                        if (viewMode == 0) {
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
                        if (viewMode == 0) {
                            index = (this._selectedItemIndex + 1 == children.length) ? children.length - 1 : this._selectedItemIndex + 1;
                        } else {
                            var columns = this._appGridColumns;
                            index = (this._selectedItemIndex + columns >= children.length) ? this._selectedItemIndex : this._selectedItemIndex + columns;
                        }
                    }
                } else if (symbol == Clutter.KEY_Left) {
                    if (this._selectedItemIndex != null && this._selectedItemIndex > 0) {
                        if (viewMode == 0) {
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
                        if (viewMode == 0) {
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
                        Gio.app_info_launch_default_for_uri(item_actor._delegate._app.uri, global.create_app_launch_context());
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
        if (itemActor._delegate._type == 0) {
           this.selectedAppTitle.set_text(itemActor._delegate._app.get_name());
           if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.get_description());
           else this.selectedAppDescription.set_text("");
        } else if (itemActor._delegate._type == 1) {
           this.selectedAppTitle.set_text(itemActor._delegate._app.name);
           if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
           else this.selectedAppDescription.set_text("");
        } else if (itemActor._delegate._type == 2) {
           this.selectedAppTitle.set_text(itemActor._delegate._app.name);
           if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
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
            let startupApplications = this.categoriesBox.get_first_child()._delegate;
            if (this.searchEntry.get_text() == "") {
                this._clearCategorySelections(this.categoriesBox, startupApplications);
            } else {
                this._clearCategorySelections(this.categoriesBox);
            }
        }
        this._clearCategorySelections(this.placesBox);
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
                    let allApplicationsCategory = this.categoriesBox.get_first_child()._delegate;
                    this._clearApplicationsBox(allApplicationsCategory);
                    this._displayApplications(this._listApplications(null));
                }));
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);

            this._searchIconClickedId = 0;
            if (gsVersion[1] > 6) {
                this.searchEntry.set_secondary_icon(null);
            } else {
                this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            }
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

        //let devices = this._listDevices(pattern);
        //for (var i in devices) placesResults.push(devices[i]);

        let recentResults = this._listRecent(pattern);


        this._clearApplicationsBox();
        this._displayApplications(appResults, placesResults, recentResults);

        // Set active container
        let viewMode = this._applicationsViewMode;
        this._activeContainer = (viewMode == 0) ? this.applicationsListBox : this.applicationsGridBox;

        // Any items in container?
        let children = this._activeContainer.get_children();
        if (children.length > 0){
            // Set selected app name/description
            this._selectedItemIndex = 0;
            let itemActor = children[this._selectedItemIndex];
            if (itemActor._delegate._type == 0) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.get_name());
               if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.get_description());
               else this.selectedAppDescription.set_text("");
            } else if (itemActor._delegate._type == 1) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.name);
               if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
               else this.selectedAppDescription.set_text("");
            } else if (itemActor._delegate._type == 2) {
               this.selectedAppTitle.set_text(itemActor._delegate._app.name);
               if (itemActor._delegate._app.get_description()) this.selectedAppDescription.set_text(itemActor._delegate._app.description);
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

        // popupMenuSection holds the mainbox
        let section = new PopupMenu.PopupMenuSection();

        // mainbox holds the topPane and bottomPane
        this.mainBox = new St.BoxLayout({ name: 'gnomenuMenuMainbox', style_class: 'gnomenu-main-menu-box', vertical:true });

        // Top pane holds user group, view mode, and search (packed horizonally)
        let topPane = new St.BoxLayout({ style_class: 'gnomenu-menu-top-pane' });

        // Bottom pane holds favorites, categories/places/power, applications, workspaces (packed horizontally)
        let bottomPane = new St.BoxLayout({ style_class: 'gnomenu-menu-top-pane' });

        // groupCategoryPlaces holds categories and places (packed vertically)
        this.groupCategoryPlaces = new St.BoxLayout({ style_class: 'gnomenu-category-places-box', vertical: true });

        // groupCategoryPlaces ScrollBox
        this.groupCategoryPlacesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade gnomenu-category-places-scrollbox' });
        let vscroll = this.groupCategoryPlacesScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));
        this.groupCategoryPlacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoryPlacesScrollBox.set_mouse_scrolling(true);

        // groupCategoryPlacesPower holds categories-places-scrollbox, and power group (packed vertically)
        this.groupCategoryPlacesPower = new St.BoxLayout({ style_class: 'gnomenu-category-places-power-group-box', vertical: true });


        // UserGroupBox
        this.userGroupBox = new St.BoxLayout({ style_class: 'gnomenu-user-group-box' });
        let logoutUser = new GroupButton('user-logout-symbolic', 24, null, {style_class: 'gnomenu-user-group-button'});
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
        logoutUser.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to logout user
            logoutUser.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.LogoutRemote(0);
        }));
        let lockScreen = new GroupButton('user-lock-symbolic', 24, null, {style_class: 'gnomenu-user-group-button'});
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
        lockScreen.actor.connect('button-release-event', Lang.bind(this, function() {
            // code for lock options
            lockScreen.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            if (gsVersion[1] > 4) {
                Main.overview.hide();
                Main.screenShield.lock(true);
            } else {
                Main.overview.hide();
                let statusMenu = Main.panel._statusArea.userMenu;
                statusMenu._screenSaverProxy.LockRemote();
            }
        }));
        let tweakTool = new GroupButton( 'tweak-tool-symbolic', 24, null, {style_class: 'gnomenu-user-group-button'});
        tweakTool.actor.connect('enter-event', Lang.bind(this, function() {
            tweakTool.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('Advanced Settings'));
            this.selectedAppDescription.set_text('');
        }));
        tweakTool.actor.connect('leave-event', Lang.bind(this, function() {
            tweakTool.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        tweakTool.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to launch tweak tool
            tweakTool.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            let app = Shell.AppSystem.get_default().lookup_app('gnome-tweak-tool.desktop');
            app.activate();
        }));
        let controlCenter = new GroupButton( 'control-center-symbolic', 24, null, {style_class: 'gnomenu-user-group-button'});
        controlCenter.actor.connect('enter-event', Lang.bind(this, function() {
            controlCenter.actor.add_style_pseudo_class('active');
            this.selectedAppTitle.set_text(_('System Settings'));
            this.selectedAppDescription.set_text('');
        }));
        controlCenter.actor.connect('leave-event', Lang.bind(this, function() {
            controlCenter.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
        }));
        controlCenter.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to launch control center
            controlCenter.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            let app = Shell.AppSystem.get_default().lookup_app('gnome-control-center.desktop');
            app.activate();
        }));
        let userGroupBoxSpacer1 = new St.Label({text: ''});
        let userGroupBoxSpacer2 = new St.Label({text: ''});
        let userGroupBoxSpacer3 = new St.Label({text: ''});
        this.userGroupBox.add(logoutUser.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(userGroupBoxSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(lockScreen.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(userGroupBoxSpacer2, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(tweakTool.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(userGroupBoxSpacer3, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.userGroupBox.add(controlCenter.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});


        // ViewModeBox
        this.viewModeBoxWrapper = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box-wrapper' });
        this.viewModeBox = new St.BoxLayout({ style_class: 'gnomenu-view-mode-box' });
        let listView = new GroupButton('list-symbolic', 24, null, {style_class: 'gnomenu-view-mode-button'});
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
        listView.actor.connect('button-release-event', Lang.bind(this, function() {
            listView.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this._switchApplicationsView(0);
        }));
        let gridView = new GroupButton( 'grid-symbolic', 24, null, {style_class: 'gnomenu-view-mode-button'});
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
        gridView.actor.connect('button-release-event', Lang.bind(this, function() {
            gridView.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this._switchApplicationsView(1);
        }));
        this.viewModeBox.add(gridView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBox.add(listView.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.viewModeBoxWrapper.add_actor(this.viewModeBox);


        // SearchBox
        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find-symbolic' });
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear-symbolic' });
        this.searchBox = new St.BoxLayout({ style_class: 'gnomenu-search-box' });
        this.searchEntry = new St.Entry({ name: 'searchEntry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
        if (gsVersion[1] > 6) {
            this.searchEntry.set_primary_icon(this._searchInactiveIcon);
        } else {
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        }
        this.searchBox.add(this.searchEntry, {expand: true, x_align:St.Align.START, y_align:St.Align.START});
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";


        // FavoritesBox
        this.favoritesBox = new St.BoxLayout({ style_class: 'gnomenu-favorites-box', vertical: true });
        this.favoritesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade gnomenu-favorites-scrollbox' });
        this.favoritesScrollBox.add_actor(this.favoritesBox);
        this.favoritesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.favoritesScrollBox.set_mouse_scrolling(true);

        //Load favorites
        this.favorites = [];
        let launchers = global.settings.get_strv('favorite-apps');
        let j = 0;
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = Shell.AppSystem.get_default().lookup_app(launchers[i]);
            if (app) {
                this.favorites.push(app);
                let favoriteButton = new FavoriteButton(app);
                this.favoritesBox.add_actor(favoriteButton.actor);
                favoriteButton.actor.connect('enter-event', Lang.bind(this, function() {
                    favoriteButton.actor.add_style_pseudo_class('active');
                    this.selectedAppTitle.set_text(favoriteButton._app.get_name());
                    if (favoriteButton._app.get_description()) this.selectedAppDescription.set_text(favoriteButton._app.get_description());
                    else this.selectedAppDescription.set_text("");
                }));
                favoriteButton.actor.connect('leave-event', Lang.bind(this, function() {
                    favoriteButton.actor.remove_style_pseudo_class('active');
                    this.selectedAppTitle.set_text("");
                    this.selectedAppDescription.set_text("");
                }));
                favoriteButton.actor.connect('button-release-event', Lang.bind(this, function() {
                    favoriteButton.actor.remove_style_pseudo_class('active');
                    this.selectedAppTitle.set_text("");
                    this.selectedAppDescription.set_text("");
                    favoriteButton._app.open_new_window(-1);
                    this.menu.close();
                }));
                ++j;
            }
        }


        // CategoriesBox
        this.categoriesBox = new St.BoxLayout({ style_class: 'gnomenu-categories-box', vertical: true });

        // Load 'all applications' category
        this.applicationsByCategory = {};
        let appCategory = new CategoryListButton(null, _('All Applications'));
        if (settings.get_enum('category-selection-method') == selectMethod.HOVER ) {
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
                //appCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(appCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            appCategory.actor.connect('leave-event', Lang.bind(this, function() {
                //appCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            appCategory.actor.connect('clicked', Lang.bind(this, function() {
                this._selectCategory(appCategory);
                this.selectedAppTitle.set_text(appCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.categoriesBox.add_actor(appCategory.actor);

        // Load rest of categories
        let tree = Shell.AppSystem.get_default().get_tree();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                this.applicationsByCategory[dir.get_menu_id()] = new Array();
                this._loadCategories(dir);
                if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                    let appCategory = new CategoryListButton(dir);
                    if (settings.get_enum('category-selection-method') == selectMethod.HOVER) {
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
                            //appCategory.actor.add_style_pseudo_class('active');
                            this.selectedAppTitle.set_text(appCategory.label.get_text());
                            this.selectedAppDescription.set_text('');
                        }));
                        appCategory.actor.connect('leave-event', Lang.bind(this, function() {
                            //appCategory.actor.remove_style_pseudo_class('active');
                            this.selectedAppTitle.set_text('');
                            this.selectedAppDescription.set_text('');
                        }));
                        appCategory.actor.connect('clicked', Lang.bind(this, function() {
                            this._selectCategory(appCategory);
                            this.selectedAppTitle.set_text(appCategory.label.get_text());
                            this.selectedAppDescription.set_text('');
                        }));
                    }
                    this.categoriesBox.add_actor(appCategory.actor);
                }
            }
        }


        // PlacesBox
        this.placesBox = new St.BoxLayout({ style_class: 'gnomenu-places-box', vertical: true });

        // Load 'all places' category
        let placesCategory = new CategoryListButton(null, _('All Places'));
        if (settings.get_enum('category-selection-method') == selectMethod.HOVER ) {
            placesCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectAllPlaces(placesCategory);
                this.selectedAppTitle.set_text(placesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            placesCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            placesCategory.actor.connect('enter-event', Lang.bind(this, function() {
                //placesCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(placesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            placesCategory.actor.connect('leave-event', Lang.bind(this, function() {
                //placesCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            placesCategory.actor.connect('clicked', Lang.bind(this, function() {
                this._selectAllPlaces(placesCategory);
                this.selectedAppTitle.set_text(placesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.placesBox.add_actor(placesCategory.actor);

        // Load bookmarks category
        let bookmarksCategory = new CategoryListButton(null, _('Bookmarks'));
        if (settings.get_enum('category-selection-method') == selectMethod.HOVER ) {
            bookmarksCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectBookmarks(bookmarksCategory);
                this.selectedAppTitle.set_text(bookmarksCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            bookmarksCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            bookmarksCategory.actor.connect('enter-event', Lang.bind(this, function() {
                //bookmarksCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(bookmarksCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            bookmarksCategory.actor.connect('leave-event', Lang.bind(this, function() {
                //bookmarksCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            bookmarksCategory.actor.connect('clicked', Lang.bind(this, function() {
                this._selectBookmarks(bookmarksCategory);
                this.selectedAppTitle.set_text(bookmarksCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.placesBox.add_actor(bookmarksCategory.actor);

        // Load devices category
        let devicesCategory = new CategoryListButton(null, _('Devices'));
        if (settings.get_enum('category-selection-method') == selectMethod.HOVER ) {
            devicesCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectDevices(devicesCategory);
                this.selectedAppTitle.set_text(devicesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            devicesCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            devicesCategory.actor.connect('enter-event', Lang.bind(this, function() {
                //devicesCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(devicesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            devicesCategory.actor.connect('leave-event', Lang.bind(this, function() {
                //devicesCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            devicesCategory.actor.connect('clicked', Lang.bind(this, function() {
                this._selectDevices(devicesCategory);
                this.selectedAppTitle.set_text(devicesCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.placesBox.add_actor(devicesCategory.actor);

        // Load recent category
        let recentCategory = new CategoryListButton(null, _('Recent'));
        if (settings.get_enum('category-selection-method') == selectMethod.HOVER ) {
            recentCategory.actor.connect('enter-event', Lang.bind(this, function() {
                this._selectRecent(recentCategory);
                this.selectedAppTitle.set_text(recentCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            recentCategory.actor.connect('leave-event', Lang.bind(this, function() {
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
        } else {
            recentCategory.actor.connect('enter-event', Lang.bind(this, function() {
                //recentCategory.actor.add_style_pseudo_class('active');
                this.selectedAppTitle.set_text(recentCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
            recentCategory.actor.connect('leave-event', Lang.bind(this, function() {
                //recentCategory.actor.remove_style_pseudo_class('active');
                this.selectedAppTitle.set_text('');
                this.selectedAppDescription.set_text('');
            }));
            recentCategory.actor.connect('clicked', Lang.bind(this, function() {
                this._selectRecent(recentCategory);
                this.selectedAppTitle.set_text(recentCategory.label.get_text());
                this.selectedAppDescription.set_text('');
            }));
        }
        this.placesBox.add_actor(recentCategory.actor);

        // PowerGroupBox
        this.powerGroupBox = new St.BoxLayout({ style_class: 'gnomenu-power-group-box'});
        let systemRestart = new GroupButton('refresh-symbolic', 24, null, {style_class: 'gnomenu-power-group-button'});
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
        systemRestart.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to refresh shell
            systemRestart.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            global.reexec_self();
        }));
        let systemSuspend = new GroupButton('suspend-symbolic', 24, null, {style_class: 'gnomenu-power-group-button'});
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
        systemSuspend.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to suspend
            systemSuspend.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            if (gsVersion[1] > 4) {
                let statusMenu = Main.panel.statusArea.userMenu;
                if (statusMenu._upClient.get_can_suspend()) {
                    Main.overview.hide();
                    let LOCK_ENABLED_KEY = 'lock-enabled';
                    if (statusMenu._screenSaverSettings.get_boolean(LOCK_ENABLED_KEY)) {
                        let tmpId = Main.screenShield.connect('lock-screen-shown', Lang.bind(this, function() {
                            Main.screenShield.disconnect(tmpId);
                            statusMenu._upClient.suspend_sync(null);
                        }));
                        Main.screenShield.lock(true);
                    } else {
                        statusMenu._upClient.suspend_sync(null);
                    }
                }
            } else {
                let statusMenu = Main.panel._statusArea.userMenu;
                if (statusMenu._upClient.get_can_suspend()) {
                    Main.overview.hide();
                    statusMenu._screenSaverProxy.LockRemote(Lang.bind(this, function() {
                        statusMenu._upClient.suspend_sync(null);
                    }));
                }
            }
        }));
        let systemShutdown = new GroupButton('shutdown-symbolic', 24, null, {style_class: 'gnomenu-power-group-button'});
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
        systemShutdown.actor.connect('button-release-event', Lang.bind(this, function() {
            // code to shutdown (power off)
            systemShutdown.actor.remove_style_pseudo_class('active');
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
            this.menu.close();
            this._session.ShutdownRemote();
        }));

        let powerGroupBoxSpacer1 = new St.Label({text: ''});
        let powerGroupBoxSpacer2 = new St.Label({text: ''});
        this.powerGroupBox.add(systemRestart.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer1, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(systemSuspend.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(powerGroupBoxSpacer2, {expand: true, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});
        this.powerGroupBox.add(systemShutdown.actor, {x_fill:false, y_fill:false, x_align:St.Align.MIDDLE, y_align:St.Align.MIDDLE});


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

        // combine categories, places into one container and then into scrollbox (packed vertically)
        this.groupCategoryPlaces.add_actor(this.categoriesBox);
        this.groupCategoryPlaces.add_actor(this.placesBox);
        this.groupCategoryPlacesScrollBox.add_actor(this.groupCategoryPlaces);

        // combine categories, places, and power group into one container (packed vertically)
        this.groupCategoryPlacesPower.add_actor(this.groupCategoryPlacesScrollBox);
        this.groupCategoryPlacesPower.add_actor(this.powerGroupBox);

        // bottomPane packs horizontally
        bottomPane.add_actor(this.favoritesScrollBox);
        bottomPane.add(this.groupCategoryPlacesPower, {x_fill: false, y_fill: false, x_align:St.Align.START, y_align:St.Align.START});
        bottomPane.add_actor(this.applicationsScrollBox);
        //bottomPane.add_actor(this.workspacesBox);

        // mainbox packs vertically
        this.mainBox.add_actor(topPane);
        this.mainBox.add_actor(bottomPane);

        // add all to section
        section.actor.add_actor(this.mainBox);

        // place selectedBox directly into section below mainBox
        section.actor.add_actor(this.selectedAppBox);

        // add section as menu item
        this.menu.addMenuItem(section);


        // Set height constraints on scrollboxes (we also set height when menu toggle)
        this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({name: 'constraint', source: this.groupCategoryPlacesPower, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));
        this.favoritesScrollBox.add_constraint(new Clutter.BindConstraint({name: 'constraint', source: this.groupCategoryPlacesPower, coordinate: Clutter.BindCoordinate.HEIGHT, offset: 0}));
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
        this.actor.connect('notify::allocation', Lang.bind(this, this._onGnoMenuPanelButtonAllocate));

        this._display();
    },

    refresh: function() {
        if (_DEBUG_) global.log("GnoMenu: refresh");
        this._clearAll();
        this._display();
    },

    _clearAll: function() {
        if (_DEBUG_) global.log("GnoMenu: _clearAll");
        if (this._hotCorner) this.actor.remove_actor(this._hotCorner.actor);
        if (this._hotCorner) this._hotCorner.destroy();
        this._hotCorner = null;
        if (_DEBUG_) global.log("GnoMenu: _clearAll removed and destroyed hotcorner from gnomenu actor");

        if (this._hotspot) this.actor.remove_actor(this._hotspot);
        if (this._hotspot) this._hotspot.destroy();
        this._hotspot = null;
        this._hotspotId = null;
        if (_DEBUG_) global.log("GnoMenu: _clearAll removed and destroyed hotspot from gnomenu actor");

        if (gsVersion[1] > 4) {
            if (this.viewButton) this.actor.remove_actor(this.viewButton.container);
            if (this.appsButton) this.actor.remove_actor(this.appsButton.container);
            if (this.appsMenuButton) this.actor.remove_actor(this.appsMenuButton.container);
        } else {
            if (this.viewButton) this.actor.remove_actor(this.viewButton.actor);
            if (this.appsButton) this.actor.remove_actor(this.appsButton.actor);
            if (this.appsMenuButton) this.actor.remove_actor(this.appsMenuButton.actor);
        }
        if (_DEBUG_) global.log("GnoMenu: _clearAll removed panel buttons from gnomenu actor");

        if (this.viewButton) this.viewButton.actor.destroy();
        this.viewButton = null;
        if (_DEBUG_) global.log("GnoMenu: _clearAll destroyed view button");

        if (this.appsButton) this.appsButton.actor.destroy();
        this.appsButton = null;
        if (_DEBUG_) global.log("GnoMenu: _clearAll destroyed apps button");

        if (this.appsMenuButton) {
            // Unbind menu accelerator key
            if (gsVersion[1] > 6) {
                Main.wm.removeKeybinding('panel-menu-keyboard-accelerator');
            } else {
                global.display.remove_keybinding('panel-menu-keyboard-accelerator');
            }
            this.appsMenuButton.destroy();
        }
        this.appsMenuButton = null;
        if (_DEBUG_) global.log("GnoMenu: _clearAll destroyed menu button");
    },

    _display: function() {
        if (_DEBUG_) global.log("GnoMenu: _display");
        // Initialize view button
        if (!settings.get_boolean('hide-panel-view')) {
            this.viewButton = new PanelButton(_('View'));
            this.viewButton.actor.connect('button-release-event', Lang.bind(this, this._onViewButtonRelease));
        }
        if (_DEBUG_) global.log("GnoMenu: _display initialized view button");

        // Initialize apps button
        if (!settings.get_boolean('hide-panel-apps')) {
            this.appsButton = new PanelButton(_('Apps'));
            this.appsButton.actor.connect('button-release-event', Lang.bind(this, this._onAppsButtonRelease));
        }
        if (_DEBUG_) global.log("GnoMenu: _display initialized apps button");

        // Initialize apps menu button
        if (!settings.get_boolean('hide-panel-menu')) {
            this.appsMenuButton = new PanelMenuButton();
            this.appsMenuButton.actor.connect('notify::allocation', Lang.bind(this, this._onAppsMenuButtonAllocate));
            if (_DEBUG_) global.log("GnoMenu: _display initialized menu button");

            // Add hotspot area 1px high at top of appsMenuButton
            if (!settings.get_boolean('disable-panel-menu-hotspot')) {
                this._hotspot = new Clutter.Rectangle({reactive: true, opacity:0});
                this._hotspot.connect('enter-event', Lang.bind(this, this._onAppsMenuButtonHotSpotEntered));
                this._hotspotId = this._hotspot.connect('realize', Lang.bind(this, function(){}));
                if (_DEBUG_) global.log("GnoMenu: _display initialized menu hotspot");
            }

            // Bind menu accelerator key
            if (!settings.get_boolean('disable-panel-menu-keyboard')) {
                if (gsVersion[1] > 6) {
                    Main.wm.addKeybinding('panel-menu-keyboard-accelerator', settings, Meta.KeyBindingFlags.NONE, Shell.KeyBindingMode.NORMAL,
                        Lang.bind(this, function() {
                            if (this.appsMenuButton) {
                                if (!this.appsMenuButton.menu.isOpen)
                                    this.appsMenuButton.menu.toggle();
                            }
                        })
                    );
                } else {
                    global.display.add_keybinding('panel-menu-keyboard-accelerator', settings, Meta.KeyBindingFlags.NONE,
                        Lang.bind(this, function() {
                            if (this.appsMenuButton) {
                                if (!this.appsMenuButton.menu.isOpen)
                                    this.appsMenuButton.menu.toggle();
                            }
                        })
                    );
                }
            }
        }

        // Add buttons to GnoMenu actor
        if (gsVersion[1] > 4) {
            if (this.viewButton) this.actor.add(this.viewButton.container);
            if (this.appsButton) this.actor.add(this.appsButton.container);
            if (this.appsMenuButton) this.actor.add(this.appsMenuButton.container);
        } else {
            if (this.viewButton) this.actor.add(this.viewButton.actor);
            if (this.appsButton) this.actor.add(this.appsButton.actor);
            if (this.appsMenuButton) this.actor.add(this.appsMenuButton.actor);
        }
        if (_DEBUG_) global.log("GnoMenu: _display added buttons to gnomenu actor");

        // Add appsMenuButton hotspot
        if (this._hotspot) this.actor.add_actor(this._hotspot);

        // Enable Hot Corner if desired
        if (!settings.get_boolean('hide-panel-view') && !settings.get_boolean('disable-panel-view-hotcorner')) {
            if (gsVersion[1] > 6) {
                let primary = Main.layoutManager.primaryIndex;
                let corner = Main.layoutManager.hotCorners[primary];
                if (corner && corner.actor) {
                    corner.actor.show();
                }
            } else {
                this._hotCorner = new Layout.HotCorner;
                this._positionHotCorner();
                this.actor.add_actor(this._hotCorner.actor);
            }
            if (_DEBUG_) global.log("GnoMenu: _display enabled hot corner in GS34-GS36");
        } else {
            if (gsVersion[1] > 6) {
                let primary = Main.layoutManager.primaryIndex;
                let corner = Main.layoutManager.hotCorners[primary];
                if (corner && corner.actor) {
                    corner.actor.hide();
                }
            } else {
                // Do nothing. GS34-GS36 hot corner is disabled when activities button is hidden
            }
            if (_DEBUG_) global.log("GnoMenu: _display disabled hot corner in GS38");
        }

        // Add menu to panel menu manager
        if (gsVersion[1] > 4) {
            if (this.appsMenuButton) Main.panel.menuManager.addMenu(this.appsMenuButton.menu);
        } else {
            if (this.appsMenuButton) Main.panel._menus.addMenu(this.appsMenuButton.menu);
        }
    },

    // function called when allocating GnoMenuButton .. to position appsMenuButton hotspot
    // ISSUE: provides a safety net just in case the allocation cycle below isn't ready
    _onGnoMenuPanelButtonAllocate: function() {
        if (this._hotspotId && this.appsMenuButton) {
            let [x, y] = this.appsMenuButton.actor.get_transformed_position();
            let [w, h] = this.appsMenuButton.actor.get_size();
            x = Math.floor(x);
            w = Math.floor(w);
            if (_DEBUG_) global.log("_onGnoMenuPanelButtonAllocate x="+x+"  w="+w);
            this._hotspot.set_position(x, 0);
            this._hotspot.set_size(w, 1);
        }
    },

    // function called when allocating appsMenuButton .. to position appsMenuButton hotspot
    // ISSUE: provides a safety net just in case the allocation cycle above isn't ready
    _onAppsMenuButtonAllocate: function() {
        if (this._hotspotId && this.appsMenuButton) {
            let [x, y] = this.appsMenuButton.actor.get_transformed_position();
            let [w, h] = this.appsMenuButton.actor.get_size();
            x = Math.floor(x);
            w = Math.floor(w);
            if (_DEBUG_) global.log("_onAppsMenuButtonAllocate x="+x+"  w="+w);
            this._hotspot.set_position(x, 0);
            this._hotspot.set_size(w, 1);
        }
    },

    // handler for when view panel button clicked
    _onViewButtonRelease: function() {
        if (_DEBUG_) global.log("_onViewButtonRelease");
        if (Main.overview.visible) {
            if (gsVersion[1] > 4) { // GS 3.6+
                if (!Main.overview._viewSelector._showAppsButton.checked) {
                    Main.overview.hide();
                    Main.overview._viewSelector._showAppsButton.checked = false;
                } else {
                    Main.overview._viewSelector._showAppsButton.checked = false;
                }
            } else { // GS 3.4
                if (Main.overview._viewSelector._activeTab.id == "windows") {
                    Main.overview.hide();
                } else {
                    Main.overview._viewSelector.switchTab("windows");
                }
            }
        } else {
            Main.overview.show();
        }
    },

    // handler for when apps panel button clicked
    _onAppsButtonRelease: function() {
        if (_DEBUG_) global.log("_onAppsButtonRelease");
        if (Main.overview.visible) {
            if (gsVersion[1] > 4) { // GS 3.6+
                if (Main.overview._viewSelector._showAppsButton.checked) {
                    Main.overview.hide();
                    Main.overview._viewSelector._showAppsButton.checked = false;
                } else {
                    Main.overview._viewSelector._showAppsButton.checked = true;
                }
            } else { // GS 3.4
                if (Main.overview._viewSelector._activeTab.id == "applications") {
                    Main.overview.hide();
                } else {
                    Main.overview._viewSelector.switchTab("applications");
                }
            }
        } else {
            Main.overview.show();
            if (gsVersion[1] > 4) {
                Main.overview._viewSelector._showAppsButton.checked = true;
            } else {
                Main.overview._viewSelector.switchTab("applications");
            }
        }
    },

    // handler for when appsMenuButton hotspot entered
    _onAppsMenuButtonHotSpotEntered: function() {
        if (_DEBUG_) global.log("_onAppsMenuButtonHotSpotEntered");
        if (this.appsMenuButton) {
            if (!this.appsMenuButton.menu.isOpen)
                this.appsMenuButton.menu.toggle();
        }
    },

    // function called during init to position hot corner
    _positionHotCorner: function() {
        if (_DEBUG_) global.log("_positionHotCorner");
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
        if (_DEBUG_) global.log("_onStyleChanged");
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
        if (_DEBUG_) global.log("_changeStylesheet");
        let filename = 'gnomenu.css';
        if (gsVersion[1] < 6)
            filename = 'gnomenu-gs34.css';

        // Get new theme stylesheet
        let themeStylesheet = Main._defaultCssStylesheet;
        if (Main._cssStylesheet != null)
            themeStylesheet = Main._cssStylesheet;

        // Get theme directory
        let themeDirectory = GLib.path_get_dirname(themeStylesheet);
        if (_DEBUG_) global.log("new theme = "+themeStylesheet);

        // Test for gnomenu stylesheet
        let newStylesheet = themeDirectory + '/extensions/' + filename;
        if (!GLib.file_test(newStylesheet, GLib.FileTest.EXISTS)) {
            if (_DEBUG_) global.log("Theme doesn't support gnomenu .. use default stylesheet");
            let defaultStylesheet = Gio.File.new_for_path(Me.path + "/themes/default/" + filename);
            if (defaultStylesheet.query_exists(null)) {
                newStylesheet = defaultStylesheet.get_path();
            } else {
                throw new Error(_("No GnoMenu stylesheet found") + " (extension.js).");
            }
        }

        if (GnoMenuStylesheet && GnoMenuStylesheet == newStylesheet) {
            if (_DEBUG_) global.log("No change in stylesheet. Exit");
            return false;
        }

        // Change gnomenu stylesheet by updating theme
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        if (!themeContext)
            return false;

        if (_DEBUG_) global.log("themeContext is valid");
        let theme = themeContext.get_theme();
        if (!theme)
            return false;

        if (_DEBUG_) global.log("theme is valid");
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

        if (_DEBUG_) global.log("Removed previous stylesheet");
        newTheme.load_stylesheet(GnoMenuStylesheet);
        if (_DEBUG_) global.log("Added new stylesheet");
        themeContext.set_theme (newTheme);

        return true;
    },

    // handler for when new application installed
    _onAppInstalledChanged: function() {
        if (_DEBUG_) global.log("_onAppInstalledChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // handler for when favorites change
    _onFavoritesChanged: function() {
        if (_DEBUG_) global.log("_onFavoritesChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // handler for when icons change
    _onIconsChanged: function() {
        if (_DEBUG_) global.log("_onIconsChanged");
        if (this.appsMenuButton) this.appsMenuButton.refresh();
    },

    // function to bind preference setting changes
    _bindSettingsChanges: function() {
        if (_DEBUG_) global.log("_bindSettingsChanges");
        settings.connect('changed::hide-panel-view', Lang.bind(this, this.refresh));
        settings.connect('changed::hide-panel-apps', Lang.bind(this, this.refresh));
        settings.connect('changed::hide-panel-menu', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-view-hotcorner', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-menu-hotspot', Lang.bind(this, this.refresh));
        settings.connect('changed::disable-panel-menu-keyboard', Lang.bind(this, this.refresh));
        settings.connect('changed::category-selection-method', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
        settings.connect('changed::favorites-icon-size', Lang.bind(this, function() {
            if (this.appsMenuButton) this.appsMenuButton.refresh();
        }));
    },

    // function to destroy GnoMenu
    destroy: function() {
        // Disconnect global signals
        Shell.AppSystem.get_default().disconnect(this._installedChangedId);
        AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);
        IconTheme.get_default().disconnect(this._iconsChangedId);
        St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);

        // Unbind menu accelerator key
        if (gsVersion[1] > 6) {
            Main.wm.removeKeybinding('panel-menu-keyboard-accelerator');
        } else {
            global.display.remove_keybinding('panel-menu-keyboard-accelerator');
        }

        // Destroy main clutter actor: this should be sufficient
        // From clutter documentation:
        // If the actor is inside a container, the actor will be removed.
        // When you destroy a container, its children will be destroyed as well.
        this.actor.destroy();
    }

});



function loadStylesheet() {
    if (_DEBUG_) global.log("GnoMenu loadStylesheet");
    let filename = 'gnomenu.css';
    if (gsVersion[1] < 6)
        filename = 'gnomenu-gs34.css';

    // Get current theme stylesheet
    let themeStylesheet = Main._defaultCssStylesheet;
    if (Main._cssStylesheet != null)
        themeStylesheet = Main._cssStylesheet;

    // Get theme directory
    let themeDirectory = GLib.path_get_dirname(themeStylesheet);

    // Test for gnomenu stylesheet
    GnoMenuStylesheet = themeDirectory + '/extensions/' + filename;
    if (!GLib.file_test(GnoMenuStylesheet, GLib.FileTest.EXISTS)) {
        if (_DEBUG_) global.log("Theme doesn't support gnomenu .. use default stylesheet");
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
    if (_DEBUG_) global.log("GnoMenu unloadStylesheet");
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

    if (_DEBUG_) global.log("GnoMenu ENABLE");
    // Load stylesheet
    loadStylesheet();

	// Remove default Activities Button
    if (hideDefaultActivitiesButton) {
        if (gsVersion[1] > 4) {
            let button = Main.panel.statusArea['activities'];
            if (button != null) {
                button.actor.hide();
            }
        } else {
            let button = Main.panel._activitiesButton;
            if (button != null) {
                button.actor.hide();
            }
        }
	}

    // Add GnoMenu to panel
    GnoMenu = new GnoMenuButton();
    if (gsVersion[1] > 4) {
        Main.panel._leftBox.insert_child_at_index(GnoMenu.actor, 0);
    } else {
        Main.panel._leftBox.insert_child_at_index(GnoMenu.actor, 0);
    }
}

function disable() {

    if (_DEBUG_) global.log("GnoMenu DISABLE");
    // Unload stylesheet
    unloadStylesheet();

	//Restore default Activities Button
	if (hideDefaultActivitiesButton) {
        if (gsVersion[1] > 4) {
            let button = Main.panel.statusArea['activities'];
            if (button) {
                button.actor.show();
            }
        } else {
            let button = Main.panel._activitiesButton;
            if (button) {
                button.actor.show();
            }
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
    if (gsVersion[1] > 4) {
        theme.append_search_path(Me.path + "/icons/24");
    } else {
        theme.append_search_path(Me.path + "/icons/16");
    }
}
