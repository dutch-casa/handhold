use swc_common::{sync::Lrc, FileName, Mark, SourceMap, GLOBALS};
use swc_ecma_ast::EsVersion;
use swc_ecma_codegen::{text_writer::JsWriter, Emitter};
use swc_ecma_parser::{parse_file_as_module, EsSyntax, Syntax};
use swc_ecma_transforms_react::{jsx, Options, Runtime};
use swc_ecma_visit::VisitMutWith;

static REACT_RUNTIME: &str = include_str!("../vendor/react.production.min.js");
static REACT_DOM_RUNTIME: &str = include_str!("../vendor/react-dom.production.min.js");

#[tauri::command]
pub async fn compile_jsx(source: String) -> Result<String, String> {
    // SWC globals (hygiene marks) require a thread-local scope.
    GLOBALS.set(&Default::default(), || compile_jsx_inner(&source))
}

fn compile_jsx_inner(source: &str) -> Result<String, String> {
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(Lrc::new(FileName::Anon), source.to_string());

    let mut errors = Vec::new();
    let mut module = parse_file_as_module(
        &fm,
        Syntax::Es(EsSyntax {
            jsx: true,
            ..Default::default()
        }),
        EsVersion::Es2022,
        None,
        &mut errors,
    )
    .map_err(|e| format!("Parse error: {e:?}"))?;

    if !errors.is_empty() {
        return Err(format!("Parse errors: {errors:?}"));
    }

    let top_level_mark = Mark::new();
    let unresolved_mark = Mark::new();

    let mut transform = jsx(
        cm.clone(),
        None::<swc_common::comments::SingleThreadedComments>,
        Options {
            runtime: Some(Runtime::Classic),
            ..Default::default()
        },
        top_level_mark,
        unresolved_mark,
    );

    module.visit_mut_with(&mut transform);

    let mut buf = Vec::new();
    {
        let wr = JsWriter::new(cm.clone(), "\n", &mut buf, None);
        let mut emitter = Emitter {
            cfg: Default::default(),
            cm,
            comments: None,
            wr,
        };
        emitter
            .emit_module(&module)
            .map_err(|e| format!("Codegen error: {e:?}"))?;
    }

    let js = String::from_utf8(buf).map_err(|e| format!("UTF-8 error: {e}"))?;

    Ok(wrap_html(&js))
}

fn wrap_html(compiled_js: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="root"></div>
<script>{REACT_RUNTIME}</script>
<script>{REACT_DOM_RUNTIME}</script>
<script>{compiled_js}</script>
</body>
</html>"#
    )
}
