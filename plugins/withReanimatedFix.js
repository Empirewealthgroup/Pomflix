/**
 * Config plugin that injects a FOLLY_CFG_NO_COROUTINES=1 compiler flag into
 * the existing post_install block in the generated Podfile, fixing the
 * 'folly/coro/Coroutine.h file not found' build error with
 * react-native-reanimated ~3.17.x on RN 0.81.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const INJECT_MARKER = "# FOLLY_NO_COROUTINES_INJECTED";

const INJECT_CODE = `  ${INJECT_MARKER}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |cfg|
      cflags = cfg.build_settings["OTHER_CPLUSPLUSFLAGS"] || ["$(inherited)"]
      cflags = [cflags] if cflags.is_a?(String)
      flag = "-DFOLLY_CFG_NO_COROUTINES=1"
      cflags << flag unless cflags.include?(flag)
      cfg.build_settings["OTHER_CPLUSPLUSFLAGS"] = cflags
      cfg.build_settings["CLANG_WARN_OVERRIDING_METHOD_MISMATCH"] = "NO"
    end
  end`;

const withReanimatedFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf8");

      // Already patched — skip
      if (contents.includes(INJECT_MARKER)) return config;

      // Inject after the opening line of the existing post_install block
      if (contents.includes("post_install do |installer|")) {
        contents = contents.replace(
          "post_install do |installer|",
          `post_install do |installer|\n${INJECT_CODE}`
        );
      } else {
        // Fallback: no existing block — add one
        contents +=
          "\npost_install do |installer|\n" + INJECT_CODE + "\nend\n";
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withReanimatedFix;
