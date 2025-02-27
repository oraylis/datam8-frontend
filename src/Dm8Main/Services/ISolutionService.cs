using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Models;
using Prism.Events;
using PropertyTools.Wpf;

namespace Dm8Main.Services
{

 

    public interface ISolutionService : INotifyPropertyChanged
    {   
        Dm8Data.Solution Solution { get; set; }

        public GitHelper GitHelper {  get; set; }

        public SolutionHelper SolutionHelper { get; set; }        

        public ColorTheme Theme { get; set; }

        public string GitPath { get; set; }

        public string GeneratorParameterStage { get; set; }
        public string GeneratorParameterOutput { get; set; }

        public string MsBuildPath {  get; set; }

        public string PythonPath { get; set; }

        public IEnumerable<ProjectItem> AllProjectItems { get; }

        public ObservableCollection<ProjectItem> ProjectItems { get; set; }

        public ObservableCollection<string> OutputTypes { get; set; }

        public ObservableCollection<OutputItem> OutputItems { get; set; }

        public ObservableDictionary<string, OutputText> OutputTexts { get; set; }

        public Task SaveAsync();

        public bool WatcherEnable { get; set; }
        public bool GitActive { get; set; }
    }
}
