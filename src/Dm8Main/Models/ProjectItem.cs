/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Dm8Data.Helper;
using Dm8Main.Base;
using Dm8Main.Services;
using MahApps.Metro.IconPacks;
using Prism.Commands;
using Prism.Events;

namespace Dm8Main.Models
{
#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE0057 // Use range operator
#pragma warning disable CA1416
#pragma warning disable CS0618   // disable deprecate for Icons
   public class ProjectItem:HierarchicalItem<ProjectItem>
   {
      public enum Types
      {
         Solution,
         Folder,
         BaseFolder,
         RawFolder,
         RawSubFolder,
         RawEntity,
         StagingFolder,
         StagingEntity,
         CoreFolder,
         CoreEntity,
         CuratedFolder,
         CuratedEntity,
         DataTypes,
         AttributeTypes,
         DataSources,
         DataProducts,
         GenerateFolder,
         GenerateSubFolder,
         GenerateFilePython,
         GenerateJinja2,
         OutputFolder,
         CodeFile,
         DiagramFolder,
         DiagramFile
      }

      private readonly IEventAggregator eventAggregator;


      private readonly ISolutionService solutionService;


      #region Property GitStatus
      public GitHelper.GitStatus GitStatus
      {
         get => this.gitStatus;
         set => this.SetProperty(ref this.gitStatus ,value);
      }

      private GitHelper.GitStatus gitStatus;
      #endregion

      #region Property NameEdit
      public string NameEdit
      {
         get => this.nameEdit;
         set => this.SetProperty(ref this.nameEdit ,value);
      }

      private string nameEdit;
      #endregion

      #region Property FilePath
      public string FilePath
      {
         get => this.filePath;
         set => this.SetProperty(ref this.filePath ,value);
      }

      private string filePath;
      #endregion

      #region Property CanRename
      public bool CanRename
      {
         get => this.canRename;
         set => this.SetProperty(ref this.canRename ,value);
      }

      private bool canRename;
      #endregion

      #region Property CanDelete
      public bool CanDelete
      {
         get => this.canDelete;
         set => this.SetProperty(ref this.canDelete ,value);
      }

      private bool canDelete;
      #endregion

      #region Property IsNewMode
      public bool IsEditMode
      {
         get => this.isEditMode;
         set => this.SetProperty(ref this.isEditMode ,value);
      }

      private bool isEditMode;
      #endregion

      #region Property IsEditFocus
      public bool IsEditFocus
      {
         get => this.isEditFocus;
         set => this.SetProperty(ref this.isEditFocus ,value);
      }

      private bool isEditFocus;
      #endregion

      #region Property IsEditFocus
      public InputBindingCollection InputBindings
      {
         get => this.inputBindings;
         private set => this.SetProperty(ref this.inputBindings ,value);
      }

      private InputBindingCollection inputBindings;
      #endregion

      #region Property RelativeFilePath
      public string RelativeFilePath
      {
         get => this.relativeFilePath;
         set => this.SetProperty(ref this.relativeFilePath ,value);
      }

      private string relativeFilePath;
      #endregion

      #region Property Type
      public Types Type
      {
         get => this.type;
         set => this.SetProperty(ref this.type ,value);
      }

      private Types type;
      #endregion

      #region Property GitImages
      public List<PackIconControlBase> GitImages
      {
         get => _gitImages;
         set => this.SetProperty(ref _gitImages ,value);
      }

      private List<PackIconControlBase> _gitImages;
      #endregion

      #region Property Images
      public List<PackIconControlBase> Images
      {
         get => this.images;
         set => this.SetProperty(ref this.images ,value);
      }

      private List<PackIconControlBase> images;
      #endregion

      #region Property ImagesToolTip
      public List<PackIconControlBase> ImagesToolTip
      {
         get => this.imagesToolTip;
         set => this.SetProperty(ref this.imagesToolTip ,value);
      }

      private List<PackIconControlBase> imagesToolTip;
      #endregion

      #region Property ImagesEdit
      public List<PackIconControlBase> ImagesEdit
      {
         get => this.imagesEdit;
         set => this.SetProperty(ref this.imagesEdit ,value);
      }

      private List<PackIconControlBase> imagesEdit;
      #endregion

      #region Property ContextCommandList
      public ObservableCollection<ContextMenuItem> ContextCommandList
      {
         get => this.contextCommandList;
         set => this.SetProperty(ref this.contextCommandList ,value);
      }

      private ObservableCollection<ContextMenuItem> contextCommandList;
      #endregion

      #region Property EditFocusLostCommand
      public DelegateCommand<RoutedEventArgs> EditFocusLostCommand
      {
         get => this.editFocusLostCommand;
         set => this.SetProperty(ref this.editFocusLostCommand ,value);
      }

      private DelegateCommand<RoutedEventArgs> editFocusLostCommand;
      #endregion

      #region Property KeyDownCommand
      public DelegateCommand<KeyEventArgs> KeyDownCommand
      {
         get => this.keyDownCommand;
         set => this.SetProperty(ref this.keyDownCommand ,value);
      }

      private DelegateCommand<KeyEventArgs> keyDownCommand;
      #endregion

      #region Property IsFolder
      public bool IsFolder =>
          this.Type == Types.Folder ||
          this.Type == Types.RawSubFolder ||
          this.Type == Types.BaseFolder ||
          this.Type == Types.StagingFolder ||
          this.Type == Types.RawFolder ||
          this.Type == Types.CoreFolder ||
          this.Type == Types.OutputFolder ||
          this.Type == Types.GenerateSubFolder ||
          this.Type == Types.CuratedFolder ||
          this.Type == Types.DiagramFolder ||
          this.Type == Types.GenerateFolder;

      #endregion

      #region Property IsArea

      private bool IsArea =>
          this.Type == Types.StagingFolder ||
          this.Type == Types.RawFolder ||
          this.Type == Types.CuratedFolder ||
          this.Type == Types.DiagramFolder ||
          this.Type == Types.CoreFolder;

      #endregion


      public static ProjectItem CreateItem(Types type ,ISolutionService solutionService ,IEventAggregator eventAggregator ,string relPath = null)
      {

         string name = String.IsNullOrEmpty(relPath) ? "" : relPath.Substring(relPath.LastIndexOf(Path.DirectorySeparatorChar) + 1);
         //var areas = solutionService.Solution.AreaNames;
         var renameArea = false;
         switch (type)
         {
            // root & static objects
            case Types.Solution:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.Solution ,PathHelper.Combine(solutionService.Solution.CurrentRootFolder ,name) ,relPath: relPath ,canRename: true);

            case Types.BaseFolder:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Base_Definitions ,Types.BaseFolder ,solutionService.Solution.BasePath);

            case Types.DataTypes:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Data_Types ,Types.DataTypes ,solutionService.Solution.DataTypesFilePath);

            case Types.DataProducts:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_DataProducts ,Types.DataProducts ,solutionService.Solution.DataProductsFilePath);

            case Types.DataSources:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Data_Sources ,Types.DataSources ,solutionService.Solution.DataSourcesFilePath);

            case Types.AttributeTypes:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Attribute_Types ,Types.AttributeTypes ,solutionService.Solution.AttributeTypesFilePath);

            case Types.RawFolder:
               return new ProjectItem(solutionService ,eventAggregator ,
                   solutionService.Solution.AreaTypes.Raw ,
                   Types.RawFolder ,
                   solutionService.Solution.RawFolderPath ,relPath: relPath ,canRename: renameArea);

            case Types.RawEntity:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.RawEntity ,PathHelper.Combine(solutionService.Solution.RawFolderPath ,relPath) ,relPath: relPath ,canRename: true ,canDelete: true);

            case Types.StagingFolder:
               string f = solutionService.Solution.AreaTypes.Stage;
               if (f == "Stage")
               {
                  f = "Staging";
               }
               return new ProjectItem(solutionService ,eventAggregator ,
                   f ,Types.StagingFolder ,
                   solutionService.Solution.StagingFolderPath ,relPath: relPath ,canRename: renameArea);

            case Types.StagingEntity:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.StagingEntity ,PathHelper.Combine(solutionService.Solution.StagingFolderPath ,relPath) ,relPath ,canDelete: true);

            case Types.CoreFolder:
               return new ProjectItem(solutionService ,eventAggregator ,
                   solutionService.Solution.AreaTypes.Core ,Types.CoreFolder ,
                   solutionService.Solution.CoreFolderPath ,relPath: relPath ,canRename: renameArea);

            case Types.CoreEntity:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.CoreEntity ,PathHelper.Combine(solutionService.Solution.CoreFolderPath ,relPath) ,relPath ,canRename: true ,canDelete: true);

            case Types.CuratedFolder:
               return new ProjectItem(solutionService ,eventAggregator ,
                   solutionService.Solution.AreaTypes.Curated ,Types.CuratedFolder ,
                   solutionService.Solution.CuratedFolderPath ,relPath: relPath ,canRename: renameArea);

            case Types.CuratedEntity:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.CuratedEntity ,Path.Combine(solutionService.Solution.CuratedFolderPath ,relPath) ,relPath ,canRename: true ,canDelete: true);

            case Types.DiagramFolder:
               return new ProjectItem(solutionService ,eventAggregator ,
                   solutionService.Solution.AreaTypes.Diagram ,Types.DiagramFolder ,
                   solutionService.Solution.DiagramFolderPath ,relPath: relPath ,canRename: renameArea);

            case Types.DiagramFile:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.DiagramFile ,Path.Combine(solutionService.Solution.DiagramFolderPath ,relPath) ,relPath ,canRename: true ,canDelete: true);

            case Types.GenerateFolder:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Generate ,Types.GenerateFolder ,solutionService.Solution.GenerateFolderPath);

            case Types.OutputFolder:
               return new ProjectItem(solutionService ,eventAggregator ,Dm8Data.Properties.Resources.Folder_Output ,Types.OutputFolder ,solutionService.Solution.OutputFolderPath);

            // objects from file system
            case Types.RawSubFolder:
               return new ProjectItem(solutionService ,eventAggregator ,name ,type ,PathHelper.Combine(solutionService.Solution.RawFolderPath ,relPath) ,relPath ,canDelete: true);

            case Types.Folder:
               return new ProjectItem(solutionService ,eventAggregator ,name ,type ,PathHelper.Combine(solutionService.Solution.CurrentRootFolder ,relPath) ,relPath);

            case Types.GenerateSubFolder:
               return new ProjectItem(solutionService ,eventAggregator ,name ,type ,PathHelper.Combine(solutionService.Solution.GenerateFolderPath ,relPath) ,relPath ,canDelete: true);

            case Types.GenerateFilePython:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.GenerateFilePython ,path: PathHelper.Combine(solutionService.Solution.GenerateFolderPath ,relPath) ,relPath: relPath ,canRename: true ,canDelete: true);

            case Types.GenerateJinja2:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.GenerateJinja2 ,path: PathHelper.Combine(solutionService.Solution.GenerateFolderPath ,relPath) ,relPath: relPath ,canRename: true ,canDelete: true);

            case Types.CodeFile:
               return new ProjectItem(solutionService ,eventAggregator ,name ,Types.CodeFile ,PathHelper.Combine(solutionService.Solution.OutputFolderPath ,relPath) ,relPath: relPath ,canDelete: true);
         }

         throw new NotImplementedException();
      }

      private ProjectItem(ISolutionService solutionService ,IEventAggregator eventAggregator ,string name ,Types type ,string path ,string relPath = null ,bool canRename = false ,bool canDelete = false)
      {
         // other services
         this.solutionService = solutionService;
         this.eventAggregator = eventAggregator;

         // properties
         this.Name = name;
         this.CanDelete = canDelete;
         this.CanRename = canRename;
         this.IsEditMode = false;
         this.IsEditFocus = false;
         this.Type = type;
         this.RelativeFilePath = relPath;
         this.FilePath = path;
         this.InputBindings = [];
         this.PropertyChanged += this.ProjectItem_PropertyChanged;
         this.solutionService.PropertyChanged += this.GlobalSettingsService_PropertyChanged;
         this.EditFocusLostCommand = new DelegateCommand<RoutedEventArgs>(this.EditFocusLost);
         this.KeyDownCommand = new DelegateCommand<KeyEventArgs>(this.KeyDown);
         this.GetImages();
         this.GetGitImages();
         this.CreateContextMenu();
      }



      public override ProjectItem GetThis()
      {
         return this;
      }



      public override void CopyAttributes(HierarchicalItem<ProjectItem> other)
      {
         var otherItem = other.GetThis();
         this.Type = otherItem.Type;
         this.FilePath = otherItem.FilePath;
         this.GitStatus = otherItem.GitStatus;
         this.GetImages();
         this.GetGitImages();
         base.CopyAttributes(other);
      }


      public SolidColorBrush GetImageColor()
      {
         return this.solutionService.Theme == ColorTheme.Dark ? Brushes.White : Brushes.Black;
      }

      private void ProjectItem_PropertyChanged(object? sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(this.GitStatus))
         {
            this.GetGitImages();
         }
      }

      public void RenameEntity(string filePath ,string oldEntityName ,string newEntityName)
      {
         // new file path
         var newFilePath = PathHelper.Combine(Path.GetDirectoryName(filePath) ,newEntityName + Path.GetExtension(filePath));

         this.FilePath = newFilePath;
         this.RelativeFilePath = PathHelper.Combine(Path.GetDirectoryName(this.RelativeFilePath) ,newEntityName + Path.GetExtension(filePath));
         this.NameEdit = newEntityName + Path.GetExtension(filePath);
         this.Name = newEntityName + Path.GetExtension(filePath);
      }


      private void CreateContextMenu()
      {
         this.ContextCommandList = [];
         this.InputBindings.Clear();
         if (!this.IsFolder || this.IsArea)
         {
            if (!this.IsArea)
            {
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = Properties.Resources.Menu_Open ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.File ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<OpenDocumentsEvent>().Publish(this);
                           })
                   });
               this.InputBindings.Add(
                   new InputBinding(
                       new DelegateCommand(() =>
                       {
                          this.eventAggregator.GetEvent<OpenDocumentsEvent>().Publish(this);
                       }) ,new KeyGesture(Key.Enter)));
            }
            if (this.CanRename)
            {
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = Properties.Resources.Menu_RenameFile ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.FormTextbox ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      InputGestureText = "F2" ,
                      Command = new DelegateCommand(() => { this.eventAggregator.GetEvent<EditObjectNameEvent>().Publish(this); }) ,
                   });
               this.InputBindings.Add(
                   new InputBinding(new DelegateCommand(() => { this.eventAggregator.GetEvent<EditObjectNameEvent>().Publish(this); }) ,new KeyGesture(Key.F2)));
            }
            if (this.CanDelete)
            {
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = Properties.Resources.Menu_DeleteFile ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.TrashCanOutline ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      InputGestureText = "Del" ,
                      Command = new DelegateCommand(() => { this.eventAggregator.GetEvent<DeleteObjectEvent>().Publish(this); })
                   });
               this.InputBindings.Add(
                   new InputBinding(new DelegateCommand(() => { this.eventAggregator.GetEvent<DeleteObjectEvent>().Publish(this); }) ,new KeyGesture(Key.Delete)));

            }
         }
         switch (this.Type)
         {
            case Types.BaseFolder:
               break;
            case Types.RawFolder:
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = $"Add {solutionService.Solution.AreaTypes.Raw} Entity" , //Properties.Resources.Menu_NewSourceEntity
                      Icon = new PackIconPicolIcons()
                      {
                         Kind = PackIconPicolIconsKind.DatabaseAdd ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,ProjectItem.Types.RawFolder));
                           })
                   });
               break;
            case Types.CoreFolder:
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = $"Add {solutionService.Solution.AreaTypes.Core} Entity" ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.FileTableBoxMultipleOutline ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.CoreFolder));
                           })
                   });
               break;

            case Types.CuratedFolder:
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = $"Add {solutionService.Solution.AreaTypes.Curated} Entity" ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.CalculatorVariant ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.CuratedFolder));
                           })
                   });
               break;

            case Types.DiagramFolder:
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = $"Add {solutionService.Solution.AreaTypes.Diagram} File" ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.Graph ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.DiagramFolder));
                           })
                   });
               break;

            case Types.Folder:
               break;

            case Types.RawSubFolder:
               throw new Exception("Hier muss noch was rein!");
            //break;

            case Types.GenerateSubFolder:
            case Types.GenerateFolder:
               if (this.Type == Types.GenerateSubFolder)
               {
                  this.ContextCommandList.Add(
                      new ContextMenuItem
                      {
                         Header = Properties.Resources.Menu_RenameFolder ,
                         Icon = new PackIconMaterial()
                         {
                            Kind = PackIconMaterialKind.FormTextbox ,
                            Foreground = this.GetImageColor() ,
                            Width = 10 ,
                            Height = 10 ,
                            VerticalAlignment = VerticalAlignment.Center
                         } ,
                         InputGestureText = "F2" ,
                         Command = new DelegateCommand(() =>
                               {
                                  this.eventAggregator.GetEvent<EditObjectNameEvent>().Publish(this);
                               }) ,
                      });
                  this.InputBindings.Add(
                      new InputBinding(
                          new DelegateCommand(() =>
                          {
                             this.eventAggregator.GetEvent<EditObjectNameEvent>().Publish(this);
                          }) ,new KeyGesture(Key.F2)));
                  this.ContextCommandList.Add(
                      new ContextMenuItem
                      {
                         Header = Properties.Resources.Menu_DeleteFolder ,
                         Icon = new PackIconMaterial()
                         {
                            Kind = PackIconMaterialKind.FolderRemove ,
                            Foreground = this.GetImageColor() ,
                            Width = 10 ,
                            Height = 10 ,
                            VerticalAlignment = VerticalAlignment.Center
                         } ,
                         InputGestureText = "Del" ,
                         Command = new DelegateCommand(() =>
                               {
                                  this.eventAggregator.GetEvent<DeleteObjectEvent>().Publish(this);
                               })
                      });
                  this.InputBindings.Add(
                      new InputBinding(
                          new DelegateCommand(() =>
                          {
                             this.eventAggregator.GetEvent<DeleteObjectEvent>().Publish(this);
                          }) ,new KeyGesture(Key.Delete)));
               }

               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = Properties.Resources.Menu_NewFolder ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.FolderPlus ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.GenerateSubFolder));
                           })
                   });
               this.ContextCommandList.Add(new ContextMenuItem
               {
                  Header = Properties.Resources.Menu_NewPythonGenerate ,
                  Icon = new PackIconMaterial()
                  {
                     Kind = PackIconMaterialKind.LanguagePython ,
                     Foreground = this.GetImageColor() ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  } ,
                  Command = new DelegateCommand(() =>
                  {
                     this.eventAggregator.GetEvent<NewDocumentEvent>()
                               .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.GenerateFilePython));
                  })
               });
               this.ContextCommandList.Add(
                   new ContextMenuItem
                   {
                      Header = Properties.Resources.Menu_NewJinja2Generate ,
                      Icon = new PackIconMaterial()
                      {
                         Kind = PackIconMaterialKind.LanguageXaml ,
                         Foreground = this.GetImageColor() ,
                         Width = 10 ,
                         Height = 10 ,
                         VerticalAlignment = VerticalAlignment.Center
                      } ,
                      Command = new DelegateCommand(() =>
                           {
                              this.eventAggregator.GetEvent<NewDocumentEvent>()
                                       .Publish(new KeyValuePair<ProjectItem ,Types>(this ,Types.GenerateJinja2));
                           })
                   });
               break;
         }
      }

      public void EditItemStart()
      {
         this.IsEditMode = true;
         this.IsEditFocus = false;
         this.NameEdit = this.Name;
         this.IsEditFocus = true;
      }

      public void EditItemEnd(bool done = true)
      {
         this.IsEditMode = false;
         if (done && this.Name != this.NameEdit)
         {
            if (!this.IsArea)
            {

               string originalPath = this.FilePath;
               string newpath = PathHelper.Combine(Path.GetDirectoryName(this.FilePath) ,this.NameEdit);
               if (this.IsFolder)
               {
                  Directory.Move(this.FilePath ,newpath);
               } else
               {
                  File.Move(this.FilePath ,newpath);
               }

               this.Name = this.NameEdit;
               this.FilePath = newpath;
               this.eventAggregator.GetEvent<RenameObjectEvent>().Publish(
                   new RenameObjectArgs
                   {
                      OriginalFilePath = originalPath ,
                      ProjectItem = this
                   });
            } else
            {
               // Rename Area
               switch (this.Type)
               {
                  case Types.RawFolder:
                     solutionService.Solution.AreaTypes.Raw = this.NameEdit;
                     break;
                  case Types.StagingFolder:
                     solutionService.Solution.AreaTypes.Stage = this.NameEdit;
                     break;
                  case Types.CoreFolder:
                     solutionService.Solution.AreaTypes.Core = this.NameEdit;
                     break;
                  case Types.CuratedFolder:
                     solutionService.Solution.AreaTypes.Curated = this.NameEdit;
                     break;
                  case Types.DiagramFolder:
                     solutionService.Solution.AreaTypes.Diagram = this.NameEdit;
                     break;
               }
            }
         }
      }

      private void EditFocusLost(RoutedEventArgs obj)
      {
         this.EditItemEnd();
      }

      private void KeyDown(KeyEventArgs obj)
      {
         if (obj.Key == Key.Enter)
         {
            this.EditItemEnd();
         }
         if (obj.Key == Key.Escape)
         {
            this.EditItemEnd(false);
         }
      }

      private void GetImages()
      {
         Func<double ,PackIconControlBase> createImageFunc = null;
         switch (this.Type)
         {
            case Types.Solution:
               createImageFunc = (size) => new PackIconModern()
               {
                  Kind = PackIconModernKind.OfficeProject ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.BaseFolder:
               createImageFunc = (size) => new PackIconModern()
               {
                  Kind = PackIconModernKind.FolderLock ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.Folder:
            case Types.RawSubFolder:
            case Types.GenerateSubFolder:
               createImageFunc = (size) => new PackIconModern()
               {
                  Kind = PackIconModernKind.Folder ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.DataTypes:
               createImageFunc = (size) => new PackIconModern()
               {
                  Kind = PackIconModernKind.TypeBit ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.AttributeTypes:
               createImageFunc = (size) => new PackIconVaadinIcons()
               {
                  Kind = PackIconVaadinIconsKind.OptionA ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.DataSources:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.DatabaseEdit ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.DataProducts:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.Project ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.RawFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.CloudUpload ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.RawEntity:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.Table ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.StagingFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FileSymlinkDirectory ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.StagingEntity:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FileSymlinkFile ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.CoreFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FolderLibrary ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.CoreEntity:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.FileTableBoxMultipleOutline ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.CuratedFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FolderActive ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.CuratedEntity:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.CalculatorVariant ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.DiagramFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.Graph ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.DiagramFile:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.GraphOutline ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.GenerateFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.Code ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.GenerateFilePython:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.LanguagePython ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.GenerateJinja2:
               createImageFunc = (size) => new PackIconMaterial()
               {
                  Kind = PackIconMaterialKind.LanguageXaml ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;



            case Types.OutputFolder:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FolderLibrary ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;

            case Types.CodeFile:
               createImageFunc = (size) => new PackIconCodicons()
               {
                  Kind = PackIconCodiconsKind.FileSubmodule ,
                  Foreground = this.GetImageColor() ,
                  Width = size ,
                  Height = size ,
                  VerticalAlignment = VerticalAlignment.Center
               };
               break;
         }

         // create image
         if (createImageFunc != null)
         {
            double sizeNormal = 14.0;
            double sizeToolTip = 20.0;
            double sizeEdit = 12.0;

            this.Images = new List<PackIconControlBase>
                {
                    createImageFunc(sizeNormal)
                };

            this.ImagesToolTip = new List<PackIconControlBase>
                {
                    createImageFunc(sizeToolTip)
                };

            this.ImagesEdit =
            [
                createImageFunc(sizeEdit)
            ];
         }
      }

      private void GetGitImages()
      {
         if (this.solutionService.GitActive)
         {
            var gitImages = new List<PackIconControlBase>();
            switch (this.GitStatus)
            {
               case GitHelper.GitStatus.NoGit:
                  gitImages.Add(new PackIconUnicons()
                  {
                     Kind = PackIconUniconsKind.LinkBroken ,

                     Foreground = Brushes.DeepSkyBlue ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  });
                  break;

               case GitHelper.GitStatus.Unchanged:
                  gitImages.Add(new PackIconUnicons()
                  {
                     Kind = PackIconUniconsKind.Lock ,
                     Foreground = Brushes.DeepSkyBlue ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  });
                  break;

               case GitHelper.GitStatus.Added:
                  gitImages.Add(new PackIconUnicons()
                  {
                     Kind = PackIconUniconsKind.Plus ,
                     Foreground = Brushes.Green ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  });
                  break;

               case GitHelper.GitStatus.Modified:
                  gitImages.Add(new PackIconUnicons()
                  {
                     Kind = PackIconUniconsKind.Check ,
                     Foreground = Brushes.Red ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  });
                  break;

               case GitHelper.GitStatus.Deleted:
                  gitImages.Add(new PackIconUnicons()
                  {
                     Kind = PackIconUniconsKind.Minus ,
                     Foreground = Brushes.Brown ,
                     Width = 10 ,
                     Height = 10 ,
                     VerticalAlignment = VerticalAlignment.Center
                  });
                  break;
            }

            this.GitImages = gitImages;
         }
      }

      private void GlobalSettingsService_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(this.solutionService.Theme) && this.Images != null)
         {
            foreach (var i in this.Images)
            {
               i.Foreground = this.GetImageColor();
            }

            foreach (var i in this.ImagesToolTip)
            {
               i.Foreground = this.GetImageColor();
            }

            foreach (var i in this.ImagesEdit)
            {
               i.Foreground = this.GetImageColor();
            }
         }
      }

      public override string ToString()
      {
         return this.FilePath;
      }
   }
}
