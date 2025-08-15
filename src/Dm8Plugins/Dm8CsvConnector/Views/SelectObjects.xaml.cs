using System.Windows;
using System.Windows.Controls;
using Oraylis.DataM8.PluginBase.BaseClasses;

namespace Dm8CSVConnector.Views
{
#pragma warning disable CS8602
#pragma warning disable CS8603
#pragma warning disable CS8618
#pragma warning disable CS8600

   public partial class SelectObjects:Window
   {
      public SelectObjects()
      {
         InitializeComponent();
         OkButton.IsEnabled = false;
      }

      public string BaseFolder { get; set; }
      public IList<RawModelEntryBase> Entities
      {
         set
         {
            _entities = value;
            loadData();
         }
      }

      public RawModelEntryBase SelectedEntry
      {
         get
         {
            RawModelEntryBase retVal = null;
            foreach (DisplayObject<RawModelEntryBase> itm in SelectedFolderItems)
            {
               retVal = itm.Cargo;
               break;
            }
            return (retVal);
         }
      }
      private IList<RawModelEntryBase> _entities = new List<RawModelEntryBase>();
      private string _currentFolder = "";
      public IList<DisplayObject<RawModelEntryBase>> SelectedFolderItems
      {
         get
         {
            IList<DisplayObject<RawModelEntryBase>> files = new List<DisplayObject<RawModelEntryBase>>();
            foreach (var file in _allFiles)
            {
               if (makeFolderName(file.Cargo.Entity.FolderName) == _currentFolder)
               {
                  files.Add(file);
               }
            }
            GridObjects.ItemsSource = files;
            return (files);
         }
      }
      private IList<DisplayObject<RawModelEntryBase>> _allFiles = new List<DisplayObject<RawModelEntryBase>>();

      private void CancelButton_OnClick(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = false;
      }

      private void OkButton_OnClick(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = true;
      }
      private void loadData()
      {
         //List<DisplayFolder> folders = new List<DisplayFolder>();            
         //Root.Header = this.BaseFolder;
         //Root.IsExpanded = true;
         //foreach (var item in _entities)
         //{
         //    switch (item.Entity.ObjectType)
         //    {
         //        case "Folder":
         //            DisplayFolder f = new DisplayFolder
         //            {
         //                Name = item.Entity.Name,
         //                FullName = item.Entity.FolderName
         //            };
         //            string owner = makeFolderName(f.FullName).Replace($"|{f.Name}", "");
         //            DisplayFolder parent = folders.FirstOrDefault(x => makeFolderName(x.FullName) == owner);
         //            folders.Add(f);
         //            TreeViewItem tvi = new TreeViewItem { Header = f.Name, Tag = f, IsExpanded = true };

         //            if (parent != null)
         //            {
         //                TreeViewItem t = findItem(Root.Items, owner);
         //                if (t != null)
         //                {
         //                    t.Items.Add(tvi);
         //                }
         //                parent.Folders.Add(f);
         //            }
         //            else
         //            {
         //                Root.Items.Add(tvi);
         //            }
         //            break;
         //        case "File":
         //            if (Path.GetExtension(item.Entity.DisplayName) == ".parquet")
         //            {
         //                DisplayObject<RawModelEntryBase> obj = new DisplayObject<RawModelEntryBase>();
         //                obj.Name = item.Entity.Name;
         //                obj.DisplayName = item.Entity.DisplayName;
         //                obj.Schema = item.Schema;
         //                obj.Type = item.Entity.ObjectType;
         //                obj.Source = item.Function.SourceLocation;
         //                obj.Cargo = item;
         //                _allFiles.Add(obj);
         //            }
         //            break;
         //    }
         //}
      }
      private TreeViewItem findItem(ItemCollection list ,string search)
      {
         TreeViewItem retVal = null;
         //foreach (TreeViewItem itm in list)
         //{
         //    DisplayFolder df = (DisplayFolder)itm.Tag;
         //    if (makeFolderName(df.FullName) == search)
         //    {
         //        retVal = itm;
         //    }
         //    else
         //    {
         //        if (itm.Items.Count > 0)
         //        {
         //            retVal = findItem(itm.Items, search);
         //        }
         //    }
         //    if (retVal != null)
         //    {
         //        break;
         //    }
         //}
         return (retVal);
      }
      private string makeFolderName(string name)
      {
         name = name.Replace("/" ,"|");
         name = name.Replace("\\" ,"|");
         return (name);
      }
      private void TreeObject_SelectedItemChanged(object sender ,RoutedPropertyChangedEventArgs<object> e)
      {
         TreeViewItem tvi = e.NewValue as TreeViewItem;
         //if (tvi != null)
         //{
         //    DisplayFolder df = (DisplayFolder)tvi.Tag;
         //    if(df != null)
         //    {
         //        _currentFolder = makeFolderName(df.FullName);
         //    }
         //}
         //OkButton.IsEnabled = this.SelectedFolderItems.Count > 0;
      }
   }
}
