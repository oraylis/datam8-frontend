using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Windows.Media;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using Dm8Main.Services;
using MahApps.Metro.IconPacks;
using Dm8Data.Helper;

namespace Dm8Main.Models
{
    public class GitItem : HierarchicalItem<GitItem>
    {
        public enum GitType
        {
            Repo,
            Folder,
            File
        }

        public ISolutionService GlobalSettingsService { get; set; }

        #region Property Repo
        public string Repo
        {
            get => this.repo;
            set => this.SetProperty(ref this.repo, value);
        }

        public string repo;
        #endregion

        #region Property Type
        public GitType Type
        {
            get => this.type;
            set => this.SetProperty(ref this.type, value);
        }

        public GitType type;
        #endregion

        #region Property GitStatus
        public GitHelper.GitStatus GitStatus
        {
            get => this.gitStatus;
            set => this.SetProperty(ref this.gitStatus, value);
        }

        public GitHelper.GitStatus gitStatus;
        #endregion

        #region Property FilePath
        public string FilePath
        {
            get => this.filePath;
            set => this.SetProperty(ref this.filePath, value);
        }

        public string filePath;
        #endregion

        #region Property Images
        public List<PackIconControlBase> Images
        {
            get => this.images;
            set => this.SetProperty(ref this.images, value);
        }

        public List<PackIconControlBase> images;
        #endregion

        #region Property GitImages
        public List<PackIconControlBase> GitImages
        {
            get => this.gitImages;
            set => this.SetProperty(ref this.gitImages, value);
        }

        public List<PackIconControlBase> gitImages;
        #endregion

        #region Property ImagesToolTip
        public List<PackIconControlBase> ImagesToolTip
        {
            get => this.imagesToolTip;
            set => this.SetProperty(ref this.imagesToolTip, value);
        }

        public List<PackIconControlBase> imagesToolTip;
        #endregion



        public GitItem(GitType type, GitHelper.GitStatus status, ISolutionService globalSettingsService, string repo, string fullFileName)
        {
            this.Name = repo;
            this.FilePath = fullFileName;
            this.Type = type;
            this.GlobalSettingsService = globalSettingsService;
            this.IsExpanded = true;
            this.GitStatus = status;
            this.GetImages();

            this.GlobalSettingsService.PropertyChanged += this.GlobalSettingsService_PropertyChanged;            
        }

        public override void CopyAttributes(HierarchicalItem<GitItem>  otherItem)
        {
            this.Type = otherItem.GetThis().Type;
            this.FilePath = otherItem.GetThis().FilePath;
            this.GitStatus = otherItem.GetThis().GitStatus;
            this.GetImages();
            base.CopyAttributes(otherItem);
        }

        public override GitItem GetThis()
        {
            return this;
        }

        public SolidColorBrush GetImageColor()
        {
            return this.GlobalSettingsService.Theme == Base.ColorTheme.Dark ? Brushes.White : Brushes.Black;
        }

        private void GetImages()
        {
            Func<double, PackIconControlBase> createImageFunc = null;
            switch (this.Type)
            {

                case GitType.Repo:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.SourceRepository,
                        Foreground = this.GetImageColor(),
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;

                case GitType.Folder:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.Folder,
                        Foreground = this.GetImageColor(),
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;

                case GitType.File:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.FileCodeOutline,
                        Foreground = this.GetImageColor(),
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;
            }

            // create image
            if (createImageFunc != null)
            {
                double sizeNormal = 14.0;
                double sizeToolTip = 20.0;

                this.Images = new List<PackIconControlBase>
                {
                    createImageFunc(sizeNormal)
                };

                this.ImagesToolTip = new List<PackIconControlBase>
                {
                    createImageFunc(sizeToolTip)
                };

            }

            createImageFunc = null;
            switch (this.GitStatus)
            {

                case GitHelper.GitStatus.Added:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.FilePlusOutline,
                        Foreground = Brushes.Red,
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;

                case GitHelper.GitStatus.Modified:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.FileCheckOutline,
                        Foreground = Brushes.Red,
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;

                case GitHelper.GitStatus.Deleted:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.FileRemoveOutline,
                        Foreground = Brushes.Red,
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;

                case GitHelper.GitStatus.NoGit:
                    createImageFunc = (size) => new PackIconMaterial()
                    {
                        Kind = PackIconMaterialKind.LinkVariantOff,
                        Foreground = Brushes.Red,
                        Width = size,
                        Height = size,
                        VerticalAlignment = VerticalAlignment.Center
                    };
                    break;
            }

            // create image
            if (createImageFunc != null)
            {
                double sizeNormal = 14.0;

                this.GitImages = new List<PackIconControlBase>
                {
                    createImageFunc(sizeNormal)
                };
            }

        }

        private void GlobalSettingsService_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(this.GlobalSettingsService.Theme))
            {
                foreach (var i in this.Images)
                {
                    i.Foreground = this.GetImageColor();
                }

                foreach (var i in this.ImagesToolTip)
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
