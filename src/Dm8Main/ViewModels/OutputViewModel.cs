using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Composition;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using Dm8Data.MessageOutput;
using Dm8Main.Models;
using Dm8Main.Properties;
using Dm8Main.Services;
using Prism.Commands;
using Prism.Events;

namespace Dm8Main.ViewModels
{

    [Export]
    public class OutputViewModel : AnchorViewModel
    {
        protected IEventAggregator eventAggregator;


        public ISolutionService SolutionService { get; set; }

        #region Property SelectedOutputType
        public string SelectedOutputType
        {
            get => this.selectedOutputType;
            set => this.SetProperty(ref this.selectedOutputType, value);
        }

        private string selectedOutputType;
        #endregion

        #region Property OutputTextVisible
        public Visibility OutputTextVisible
        {
            get => this.outputTextVisible;
            set => this.SetProperty(ref this.outputTextVisible, value);
        }

        private Visibility outputTextVisible;
        #endregion

        #region Property OutputItemVisible
        public Visibility OutputItemVisible
        {
            get => this.outputItemVisible;
            set => this.SetProperty(ref this.outputItemVisible, value);
        }

        private Visibility outputItemVisible;
        #endregion

        #region Property OutputTexts
        public string OutputText
        {
            get => this.outputText;
            set => this.SetProperty(ref this.outputText, value);
        }

        private string outputText;
        #endregion



        public OutputViewModel(ISolutionService solutionService, IEventAggregator eventAggregator)
        {
            this.eventAggregator = eventAggregator;

            // Create (default) output lists
            this.SolutionService = solutionService;
            this.Title = Properties.Resources.Title_Output;
            this.SelectedOutputType = Resources.OutputViewModel_Model_Validation;


            this.PropertyChanged += this.OutputViewModel_PropertyChanged;
            this.SolutionService.OutputItems.CollectionChanged += this.OutputItems_CollectionChanged;
            this.SolutionService.OutputTexts.CollectionChanged += this.OutputText_CollectionChanged;
        }

        private void OutputText_CollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
        {
            if (e.NewItems.Count != 0 && e.NewItems[0] is KeyValuePair<string, OutputText> textOutput)
            {
                if (textOutput.Key != "Git")
                {
                    this.SelectedOutputType = textOutput.Key;
                    this.OutputText = textOutput.Value.Content.ToString();
                }
                else if (this.SelectedOutputType == "Git")
                {
                    this.OutputText = textOutput.Value.Content.ToString();
                }
            }
        }

        private void OutputItems_CollectionChanged(object? sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
        {
            this.SelectedOutputType = Resources.OutputViewModel_Model_Validation;
        }

        private void OutputViewModel_PropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(this.SelectedOutputType) && this.SelectedOutputType == Resources.OutputViewModel_Model_Validation)
            {
                this.OutputItemVisible = Visibility.Visible;
                this.OutputTextVisible = Visibility.Collapsed;
            }
            else if (e.PropertyName == nameof(this.SelectedOutputType) && this.SolutionService.OutputTexts.ContainsKey(this.SelectedOutputType))
            {
                this.OutputItemVisible = Visibility.Collapsed;
                this.OutputTextVisible = Visibility.Visible;
                this.OutputText = this.SolutionService.OutputTexts[(this.SelectedOutputType)].Content.ToString();
            }
        }

        public override async Task SaveAsync()
        {
            await Task.Yield();
        }




    }

}
