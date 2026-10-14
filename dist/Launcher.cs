using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Text.RegularExpressions;
[assembly: AssemblyTitle("OpenBundle")]
[assembly: AssemblyVersion("0.3.0.0")]
class Launcher : Form {
  string root,locale,launcherLog; readonly object logLock=new object(); bool dryRun,finished; Process process;
  Label status; ProgressBar progress; ListView apps; Button close; Timer timer;
  JavaScriptSerializer json = new JavaScriptSerializer();
  static int exitCode=1;
  [STAThread] static int Main(string[] args) {
    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
    bool dry=Array.IndexOf(args,"--dry-run")>=0; string language=null;
    for(int i=0;i<args.Length;i++) if(args[i]=="--locale"||args[i]=="/locale") {
      if(i+1>=args.Length||!Regex.IsMatch(args[i+1],@"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})+$")) return 2;
      language=args[++i];
    }
    using(Launcher form=new Launcher(dry,language)) Application.Run(form);
    return exitCode;
  }
  Launcher(bool dry,string language) {
    dryRun=dry;locale=language;Text="OpenBundle";ClientSize=new Size(540,370);MinimumSize=new Size(480,330);StartPosition=FormStartPosition.CenterScreen;
    Font=new Font("Segoe UI",9);BackColor=Color.White;
    status=new Label(){Text=dry?"Comprobando el paquete…":"Preparando instalaciones…",Dock=DockStyle.Top,Height=50,Padding=new Padding(18,16,10,0)};
    progress=new ProgressBar(){Dock=DockStyle.Bottom,Height=8,Style=ProgressBarStyle.Marquee};
    apps=new ListView(){Dock=DockStyle.Fill,View=View.Details,FullRowSelect=true,BorderStyle=BorderStyle.None};apps.Columns.Add("Aplicación",260);apps.Columns.Add("Estado",220);
    // Set the parent width before adding the right-anchored button.
    Panel bottom=new Panel(){Dock=DockStyle.Bottom,Height=50,Width=ClientSize.Width};
    close=new Button(){Text="Cerrar",Enabled=false,Width=85,Height=28,Anchor=AnchorStyles.Right|AnchorStyles.Bottom,Location=new Point(435,10)};close.Click+=(s,e)=>Close();
    LinkLabel logs=new LinkLabel(){Text="Ver registros",AutoSize=true,Location=new Point(18,17)};logs.LinkClicked+=(s,e)=>{
      string folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OpenBundle","Logs");
      if(Directory.Exists(folder))Process.Start(new ProcessStartInfo(folder){UseShellExecute=true});
    };
    bottom.Controls.Add(close);bottom.Controls.Add(logs);Controls.Add(apps);Controls.Add(status);Controls.Add(bottom);Controls.Add(progress);
    timer=new Timer(){Interval=400};timer.Tick+=(s,e)=>RefreshProgress();
    Shown+=(s,e)=>BeginInvoke(new Action(StartInstall));
    FormClosing+=(s,e)=>{if(!finished&&process!=null&&!process.HasExited){e.Cancel=true;Hide();}};
  }
  void StartInstall() {
    try {
      root=Path.Combine(Path.GetTempPath(),"OpenBundle-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
      Stream payload=Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload");
      if(payload==null)payload=File.OpenRead(Assembly.GetExecutingAssembly().Location);
      using(payload)using(ZipArchive zip=new ZipArchive(payload,ZipArchiveMode.Read))foreach(ZipArchiveEntry entry in zip.Entries){
        string path=Path.GetFullPath(Path.Combine(root,entry.FullName));
        if(!path.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Ruta no válida en el paquete.");
        Directory.CreateDirectory(Path.GetDirectoryName(path));if(entry.Name.Length>0)entry.ExtractToFile(path);
      }
      var plan=json.DeserializeObject(File.ReadAllText(Path.Combine(root,"manifest.json"))) as Dictionary<string,object>;
      if(plan==null)throw new Exception("Manifiesto no válido.");
      object[] items=plan["items"] as object[];if(items==null||items.Length==0)throw new Exception("El paquete no contiene aplicaciones.");
      foreach(object item in items){var data=item as Dictionary<string,object>;apps.Items.Add(new ListViewItem(new string[]{Convert.ToString(data["name"]),"Pendiente"}));}
      string command="-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+Path.Combine(root,"install.ps1")+"\""+(dryRun?" -DryRun":"")+(locale==null?"":" -Locale "+locale);
      process=new Process();process.StartInfo=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),command){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=root,RedirectStandardOutput=true,RedirectStandardError=true};
      string logsFolder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OpenBundle","Logs");Directory.CreateDirectory(logsFolder);launcherLog=Path.Combine(logsFolder,"launcher-"+Guid.NewGuid().ToString("N")+".log");
      process.OutputDataReceived+=(s,e)=>WriteLog(e.Data);process.ErrorDataReceived+=(s,e)=>WriteLog(e.Data);
      process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();status.Text=dryRun?"Simulación: no se instalará ningún programa.":"Instalando aplicaciones en segundo plano…";timer.Start();
    }catch(Exception error){status.Text=error.Message;finished=true;close.Enabled=true;progress.Style=ProgressBarStyle.Blocks;exitCode=1;Clean();}
  }
  void RefreshProgress() {
    try {
      string path=Path.Combine(root,"progress.json");
      if(File.Exists(path)){
        var data=json.DeserializeObject(ReadProgress(path)) as Dictionary<string,object>;
        if(data!=null){object[] rows=data["items"] as object[];if(rows!=null)for(int i=0;i<rows.Length&&i<apps.Items.Count;i++){var row=rows[i] as Dictionary<string,object>;apps.Items[i].SubItems[1].Text=Convert.ToString(row["state"]);}}
      }
    }catch{} // An atomic writer may replace the progress file between reads.
    if(process!=null&&process.HasExited){
      timer.Stop();process.WaitForExit();exitCode=process.ExitCode;finished=true;close.Enabled=true;progress.Style=ProgressBarStyle.Blocks;progress.Value=100;
      bool reboot=false;try{var result=json.DeserializeObject(ReadProgress(Path.Combine(root,"progress.json"))) as Dictionary<string,object>;if(result!=null&&result.ContainsKey("rebootRequired"))reboot=Convert.ToBoolean(result["rebootRequired"]);}catch{}
      status.Text=exitCode==0?(dryRun?"Simulación completada.":"Proceso completado."+(reboot?" Hay un reinicio pendiente.":"")):"Hay instalaciones que no se han completado. Consulta los registros.";
      Clean();if(!Visible)Close();
    }
  }
  static string ReadProgress(string path){
    // The producer atomically replaces this file while the UI polls it.
    using(var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))
    using(var reader=new StreamReader(stream))return reader.ReadToEnd();
  }
  void WriteLog(string line){if(line!=null)try{lock(logLock)File.AppendAllText(launcherLog,line+Environment.NewLine);}catch{}}
  void Clean(){if(root!=null)try{Directory.Delete(root,true);}catch{}}
  protected override void Dispose(bool disposing){if(disposing){if(timer!=null)timer.Dispose();if(process!=null)process.Dispose();}base.Dispose(disposing);}
}
